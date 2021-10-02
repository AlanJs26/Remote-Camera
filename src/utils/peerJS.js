// @ts-check

import {uid, isPeerReady} from '../stores/app.js'
import { getContext, setContext } from 'svelte'
import {auth} from '../firebase'

import Peer from 'peerjs'

/**
 * @type {Peer}
 */
let peer;
let uidVal = ''

/**
 * @type {ConnectionsHandler}
 */
export let connectionsHandler;


class ConnectionsHandler{
    
    /**
     * @param {Peer} peer
     */
    constructor(peer){
        /**
         * @type {Array <{displayName: string, conn: Peer.DataConnection, id: string, pingStrikes: number}>} 
         */
        
        this.connections = []
        this.peer = peer
        this.pingInterval = undefined
        this.subscribedActions = []
        this.isHost = false
    }

    startPingRoutine(){
        const onData = (data) => {
            try{
                let parsedData = JSON.parse(data)

                if(parsedData.type == 'pong'){
                    for(let connection of this.connections){
                        if(connection.id == parsedData.from){
                            connection.pingStrikes = 2
                        }
                    }
                }
            }catch(err){

            }
        }

        this.subscribeToAll('data', onData)

        this.pingInterval = setInterval(() => {
            this.broadcast('{"type": "ping"}')

            let onlyAwakeConnections = this.connections.filter(connection => {
                connection.pingStrikes -= 1

                if(connection.pingStrikes <= 0){
                    let conn = connection.conn

                    conn.close()

                    return false
                }
                return true
            })

            this.connections = onlyAwakeConnections
            // console.log(this.connections)

            for(let [event, callback] of this.subscribedActions){
                if(event=='ping')
                    callback()
            }

        }, 5000);
    }

    subscribeToAll(event, callback){
        this.subscribedActions.push([event, callback])

        if(event == 'ping')
            return

        for(let connection of this.connections){
            /**
             * @type {Peer.DataConnection}
             */
            let conn = connection.conn;

            conn.on(event, callback)
        }
    }

    broadcast(message){
        for(let {conn} of this.connections){
            /**
             * @type {Peer.DataConnection}
             */

            conn.send(message)
        }
    }

    addConnection(conn, displayName, id){
        let hasSame = this.connections.reduce((prev, connection) => {
            if(connection.id == id)
                return true
            return prev
        }, false)
        // console.log(`hasSame: ${hasSame}`)
        if(hasSame == false){
            this.connections.push({
                displayName,
                conn,
                id,
                pingStrikes: 2
            })

            for(let action of this.subscribedActions){
                let [event, callback] = action
                conn.on(event, callback)
            }
        }
        console.log(this.connections)
    }
}

uid.subscribe((val) => {
    if(typeof val == 'string'){
        uidVal = val
        peer = new Peer(val);

        peer.on('open', id => {
            console.log('peer id: '+id)

            connectionsHandler = new ConnectionsHandler(peer)
            isPeerReady.set(true)
        })

        // peer.on('close')


        peer.on('disconnected', () => {
            console.log('%cdisconnected from peer!', 'color: crimson')
            isPeerReady.set(false)
        })
    }else if(val == null && peer instanceof Peer){
        isPeerReady.set(false)
        peer.disconnect()
        peer.destroy()
        console.log('%cDestroying the WebRTC Connection', 'color: red; font-size: 21px')
    }
})



export async function setupMediaSources(){
    let localStream = getContext('localStream')

    if(localStream instanceof MediaStream == false){
        try{
            let devices = await navigator.mediaDevices.enumerateDevices()
            console.log(devices)
            localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        }catch(err){
            console.error('Failed to get local stream', err);
        }
        setContext('localStream', localStream);
    }

    return localStream
}

export async function setupAsHost(callback, dataCallback){
    if(peer instanceof Peer == false){
        console.warn('peer is not defined yet')
        return
    }
    let localStream = await setupMediaSources()
    connectionsHandler.startPingRoutine()
    connectionsHandler.isHost = true
    console.log('i am hosting')
    
    peer.on('call', (call) => {
        call.answer(localStream); // Answer the call with an A/V stream.
        console.log(peer.connections)
    });

    peer.on('connection', (conn) => {
        console.log('%cnew peer connected!', 'color: lightgreen')

        conn.on('data', data => {
            try{
                let parsedData = JSON.parse(data)

                if(parsedData.type != 'pong'){
                    console.groupCollapsed(`data received from %c${parsedData.displayName}%c - %c${parsedData.type}`, 'color: cyan', 'color: white', 'color: orange')
                    for(let key of Object.keys(parsedData)){
                        if(['type', 'from', 'displayName'].includes(key) == false){
                            console.group(key)
                            console.log(parsedData[key])
                            console.groupEnd()
                        }
                    }
                    console.groupEnd()
                }

                if(parsedData.type == 'handshake'){
                    connectionsHandler.addConnection(conn, parsedData.displayName, parsedData.from)
                }

                if(dataCallback){
                    // console.log(parsedData.type)
                    dataCallback(parsedData)
                    connectionsHandler.subscribeToAll('ping', dataCallback)
                }
            }catch(err){
                console.error(`data received in wrong format from unknown peer: ${err}`)
            }
        })

    })

    setContext('localStream', localStream);
    // console.log(`peerId: ${uidVal}`)
    callback(localStream);

}

const createMediaStreamFake = () => {
    return new MediaStream([createEmptyAudioTrack(), createEmptyVideoTrack({ width:640, height:480 })]);
}

const createEmptyAudioTrack = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = oscillator.connect(ctx.createMediaStreamDestination());
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    return Object.assign(track, { enabled: false });
}

const createEmptyVideoTrack = ({ width, height }) => {
    
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    canvas.getContext('2d').fillRect(0, 0, width, height);

    const stream = canvas.captureStream();
    const track = stream.getVideoTracks()[0];

    return Object.assign(track, { enabled: false });
};

export async function connectToHost(peerId, callback, dataCallback){
    if(peer instanceof Peer == false){
        console.warn('peer is not defined yet')
        return
    }

    const localStream = createMediaStreamFake()

    let conn = peer.connect(peerId)
    let user = auth.currentUser

    connectionsHandler.addConnection(conn, 'host', peerId)

    conn.on('open', () => {
        console.log('%cconnected with the host', 'color: orange')

        let data = {
            from: uidVal,
            type: 'handshake',
            displayName: user.displayName
        }
        
        conn.send(JSON.stringify(data))
    })

    conn.on('data', (data) => {
        try{
            let parsedData = JSON.parse(data)
            // console.log(`data received from host: ${parsedData.content||parsedData.type}`)
            if(parsedData.type != 'ping'){
                console.groupCollapsed(`data received from %chost%c - %c${parsedData.type}`, 'color: cyan', 'color: white', 'color: orange')
                for(let key of Object.keys(parsedData)){
                    if(['type', 'from', 'displayName'].includes(key) == false){
                        console.group(key)
                        console.log(parsedData[key])
                        console.groupEnd()
                    }
                }
                console.groupEnd()
            }

            dataCallback(parsedData)

            if(parsedData.type == 'ping'){
                let data = {
                    from: uidVal,
                    type: 'pong',
                    displayName: user.displayName
                }
                conn.send(JSON.stringify(data))
            }


            
        }catch(err){
            console.error(`data received in wrong format from host: ${err}`)
        }
    })

    let call = peer.call(peerId, localStream);
    call.on('stream', (remoteStream) => {
        // Show stream in some <video> element.
        setContext('remoteStream', remoteStream);
        if(callback){
            callback(remoteStream)
        }
    });
}