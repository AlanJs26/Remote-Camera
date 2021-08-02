<script>

    // import {answerCall, createOffer, setupMediaSources} from '../utils/webRTC'
    import {connectToHost, setupAsHost, connectionsHandler} from '../utils/peerJS'
    import {cubeSize as cubeProperties, controlsBtn, buttonsState} from '../stores/cubes'
    import {setCubesState} from "../components/Cubes.svelte";
    import {username} from '../stores/main'
    import {configBtn} from '../stores/header'
    import {uid} from '../stores/app.js'
    import { fade } from 'svelte/transition';
    import { database, auth } from '../firebase';
    // import {cubicInOut} from 'svelte/easing';

    configBtn.assignFunction('main', () => {
        console.log('%cPARECE QUE FOI!', 'color: purple;font-size: 20px')
    })

    
    let videoEl = null
    
    window.addEventListener('resize', () => {
        let w = window.outerWidth;
        // let h = window.outerHeight;
        // console.log(`window width: ${w/880}\nwindow height: ${h/600}`)
    
        cubeProperties.set({
            scale: (w/880),
        })
    })


    
    if($username.length != 0){
        connectToHost($username, (remoteStream) => {
            videoEl.srcObject = remoteStream
        },(data) => {
            if(connectionsHandler.isHost)
                return
            
            if(data.type == 'users'){
                // console.log(data)
                watchers = data.content

                let me = watchers.filter(item => item.id == $uid)
                // console.log(me)

                if(me.length){
                    if(me[0].controlLevel > 0){
                        setCubesState('btnMode')
                    }else{
                        setCubesState('floatOpening')
                    }
                }else{
                    connectionsHandler.peer.disconnect()
                }

                // watchers = data.watchers
            }
        })

        controlsBtn.assignFunction('main', n => {
            if(typeof n != 'number') return

            const message = {
                type: 'controls',
                from: connectionsHandler.peer.id,
                content: n,
                displayName: auth.currentUser.displayName
            }

            connectionsHandler.broadcast(JSON.stringify(message))
        })

        connectionsHandler.subscribeToAll('data', async rawData => {
            try{
                let data = JSON.parse(rawData)

                if(data.type == 'controlsState'){
                    buttonsState.update(prevState => {
                    for (let i = 0; i<data.content.length; i++) {
                        prevState[i] = data.content[i] ? true : false
                    }
                    return prevState
                    })
                }

            }catch(err){

            }
        })

    }else{        
        setCubesState('btnMode')

        controlsBtn.assignFunction('main', async n => {

            let twin = {
                0: 3,
                1: 2,
                2: 1,
                3: 0
            }

            let directionRef = database.ref(`users/${$uid}/direction`);

            let directions = await directionRef.get()
            directions = directions.val()||[0,0,0,0]
            directions[n] = directions[n] == 1 ? 0 : 1
            if(directions[twin[n]]==1)
                directions[twin[n]] = directions[n] == 1 ? 0 : 1

            directionRef.set(directions);

            const message = {
                type: 'controlsState',
                from: connectionsHandler.peer.id,
                content: directions,
                displayName: $username
            }
            connectionsHandler.broadcast(JSON.stringify(message))
        })

        connectionsHandler.subscribeToAll('data', async (rawData) => {
            try{
                let data = JSON.parse(rawData)

                if(data.type == 'controls'){
                    let isFromTrustedWatcher = watchers.filter(item => item.id==data.from&&item.controlLevel>0).length==1?true:false
                    if(!isFromTrustedWatcher)
                        return

                    let n = data.content

                    let twin = {
                        0: 3,
                        1: 2,
                        2: 1,
                        3: 0
                    }

                    let directionRef = database.ref(`users/${$uid}/direction`);

                    let directions = await directionRef.get()
                    directions = directions.val()||[0,0,0,0]
                    directions[n] = directions[n] == 1 ? 0 : 1
                    if(directions[twin[n]]==1)
                        directions[twin[n]] = directions[n] == 1 ? 0 : 1
                    

                    directionRef.set(directions);

                    const message = {
                        type: 'controlsState',
                        from: connectionsHandler.peer.id,
                        content: directions,
                        displayName: $username
                    }
                    connectionsHandler.broadcast(JSON.stringify(message))
                }
            }catch(err){

            }
        })

        let directionRef = database.ref(`users/${$uid}/direction`);


        directionRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if(!data) return

            buttonsState.update(prevState => {
            for (let i = 0; i<data.length; i++) {
                prevState[i] = data[i] ? true : false
            }
            return prevState
            })

            // console.log(data)
        });

        setupAsHost(localStream => {
            videoEl.srcObject = localStream
        },
        (data) => {
            if(!connectionsHandler.isHost)
                return

            if(data&&data.type == 'handshake'){
                const message = {
                    type: 'controlsState',
                    from: connectionsHandler.peer.id,
                    content: $buttonsState.map(item => item?1:0),
                    displayName: $username
                }
                connectionsHandler.broadcast(JSON.stringify(message))
            }
    
            let sameItems = []
            let newItems = []
            let extraItems = Array.from(watchers)
            for(let connection of connectionsHandler.connections){
                extraItems = extraItems.filter(item => item.id!=connection.id)
                let found = false;
                for(let watcher of watchers){
                // if(Object.values(watchers).includes(connection.id)){
                    if(watcher.id==connection.id){
                        found = true
                        sameItems.push(Object.assign({controlLevel: watcher.controlLevel}, connection))
                        break;
                    }
                }
                if(found)
                    continue
    
                newItems.push(connection)
            }
    
            watchers = []
    
            for(let item of [...sameItems, ...newItems]){
                watchers = [...watchers,{
                    name: item.displayName,
                    id: item.id,
                    // @ts-ignore
                    controlLevel: typeof item.controlLevel == 'number'?item.controlLevel:1
                }]
            }

            if(newItems.length || extraItems.length){
                broadcastOnlineWatchers()
            }
        })
    }

    function broadcastOnlineWatchers() {
        if(!connectionsHandler.isHost)
            return
        
        if(this){
            // console.log(this.getAttribute('watcher'))
            watchers = watchers.map(item => {
                if(item.name == this.getAttribute('watcher')){
                    item.controlLevel = parseInt(this.value)
                    // console.log('found')
                    return item
                }
                return item
            })
        }
        // console.log(watchers)
        const message = {
            type: 'users',
            from: $uid,
            content: watchers,
        }
        // console.log(message)
        connectionsHandler.broadcast(JSON.stringify(message))
    }
    
    let watchers = []
    let isSlidePanelOpen = false
    let isCopyAnimActive = false
    
    function copyText(){
        isCopyAnimActive = true
    
        navigator.clipboard.writeText(this.innerText).then(function() {
            // console.log('Async: Copying to clipboard was successful!');
        }, function(err) {
            console.error('Async: Could not copy text: ', err);
        });
    
        setTimeout(() => {
            isCopyAnimActive = false
        }, 800)
    }
    
    let isCopyPanelActive = false
    </script>
    
    
    <div class="flexColumn">
        
        <video id="webcamVideo" autoplay playsinline bind:this={videoEl} ></video>
    
    </div>
    <div class="floatingIcons">
        <div on:click={() => isCopyPanelActive=true} ><i class="fas fa-share fa-2x"></i></div>
        <div on:click={() => isSlidePanelOpen=true} ><i class="fas fa-user-friends fa-2x"></i></div>
    </div>
    
    <div class="slideFromRightContainer" class:open={isSlidePanelOpen} on:mouseleave={() => isSlidePanelOpen=false} >
        <h2>Participantes</h2>
        <div class="listHeader" >
            <span>Nome</span>
            <span>Nível de Controle</span>
        </div>
        <ul>
            
            {#each watchers as watcher}
                <li>
                    <span>{watcher.name}</span>
                    <div style={`pointer-events: ${connectionsHandler.isHost?'auto':'none'}`}>
                        <input on:change={broadcastOnlineWatchers} watcher={watcher.name} type="radio" bind:group={watcher.controlLevel} value={0} >
                        <input on:change={broadcastOnlineWatchers} watcher={watcher.name} type="radio" bind:group={watcher.controlLevel} value={1} >
                        <input on:change={broadcastOnlineWatchers} watcher={watcher.name} type="radio" bind:group={watcher.controlLevel} value={2} >
                    </div>
                </li>
            {/each}
        </ul>
    </div>
    
    {#if isCopyPanelActive}
        <div class="copyPanel" transition:fade on:mouseleave={() => isCopyPanelActive=false} >
            <h2>compartilhe o código abaixo para outras pessoas entrarem na sua chamada</h2>
            <div>
                <span>clique para copiar</span>
                <div>
                    <p on:click={copyText} class:active={isCopyAnimActive} >{$uid}</p>
                </div>
            </div>
        </div>
    {/if}
    
    
    <style>
        video#webcamVideo {
            --size: 90%;
            width: var(--size);
            /* height: var(--size); */
            margin-bottom: 1.5rem;
            max-width: 60vh;
            background: #2c3e50;
        }
    
        .floatingIcons {
            position: fixed;
            top: 10px;
            right: 0;
            padding: 3px;
            display: flex;
            flex-direction: row;
        }
    
        .floatingIcons > div {
            padding: 5px 15px;
            cursor: pointer;
        }
    
        .floatingIcons i {
            color: rgba(255, 255, 255, 0.7);
            transition: 0.3s;
        }
    
        .floatingIcons div:hover > i {
            color: rgba(255, 255, 255, 1);
        }
    
        .slideFromRightContainer {
            --width: 250px;
            height: 100vh;
            width: var(--width);
            position: fixed;
            background-color: #b246d2;
            box-shadow: 0 0 20px 8px #4e0d4fb3;
            right: calc(-1*var(--width));
            transition: right 0.5s;
            top: 0;
        }
    
        .slideFromRightContainer.open{
            right: 0;
        }
    
        .slideFromRightContainer ul {
            margin: 0;
            /* padding: 0 30px; */
            padding: 0;
            padding-right: 35px;
        }
    
        .slideFromRightContainer li {
            display: flex;
        }
    
        .slideFromRightContainer li > span {
            /* margin-right: 10px; */
            flex: 1;
            text-align: center;
        }
    
        input {
            appearance: none;
            -webkit-appearance: none;
            border-radius: 50%;
            width: 16px;
            height: 16px;
    
            border: 1px solid #ffffff40;
            /* border: none; */
            transition: 0.1s all linear;
            margin-right: 5px;
    
            position: relative;
            top: 4px;
            cursor: pointer;
        }
    
        .slideFromRightContainer input:nth-child(1):checked{
            background-color: red;
            border-color: red;
        }
        .slideFromRightContainer input:nth-child(2):checked{
            background-color: white;
            border-color: white;
        }
        .slideFromRightContainer input:nth-child(3):checked{
            background-color: green;
            border-color: green;
        }
    
        h2 {
            width: 100%;
            text-align: center;
        }
    
        .listHeader {
            display: flex;
            /* width: 100%; */
            text-align: center;
            /* padding: 0 30px; */
            padding: 0;
            padding-right: 40px;
            margin-bottom: 10px;
        }
    
        .listHeader span:nth-child(1) {
            flex: 1;
        }
    
        .listHeader span:nth-child(2) {
            width: 70px;
        }
    
        .copyPanel {
            width: 400px;
            padding: 10px;
            position: fixed;
            background-color: #782299;
            box-shadow: 0px 0px 20px 5px #4f194fb3;
            top: 60px;
            right: 90px;
            text-align: center;
            border-radius: 3px;
        }
    
        .copyPanel div {
            width: 100%;
        }
    
        .copyPanel div span {
            margin-left: 5px;
            color: #ffffffc4;
            font-size: 0.8em;
        }
    
        
        .copyPanel > div {
            align-items: baseline;
            display: flex;
            flex-direction: column;
        }
    
        .copyPanel div p {
            background: #611b75;
            padding: 10px;
            border: 2px solid #5b1a6d;
            border-radius: 5px;
            margin: 0;
            cursor: pointer;
            position: relative;
        }
    
        .copyPanel div p::before {
            content: 'Copiado';
            position: absolute;
            width: 100%;
            height: 100%;
            top: 0;
            left: 0;
            background: white;
            opacity: 0;
            color: #781b9c;
            line-height: 36px;
            font-weight: bold;
        }
    
        .copyPanel div p.active::before {
            animation: shine 1s normal;
        }
    
        @keyframes shine {
            0% {
                opacity: 0
            }
            50% {
                opacity: 1
            }
            100% {
                opacity: 0;
            }
        }
    
    </style>