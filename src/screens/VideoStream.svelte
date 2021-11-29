<script>
    // import {answerCall, createOffer, setupMediaSources} from '../utils/webRTC'
    import {
        connectToHost,
        setupAsHost,
        connectionsHandler,
    } from "../utils/peerJS";
    import {
        cubeSize as cubeProperties,
        controlsBtn,
        buttonsState,
    } from "../stores/cubes";
    import { setCubesState } from "../components/Cubes.svelte";
    import { username } from "../stores/main";
    import { configBtn, facetrackOn } from "../stores/header";
    import { uid } from "../stores/app.js";
    import { fade } from "svelte/transition";
    import { database, auth } from "../firebase";

    configBtn.assignFunction("main", () => {
        /* console.log("%cPARECE QUE FOI!", "color: purple;font-size: 20px"); */
        facetrackOn.update(prev => !prev)
    });

    let videoEl = null;






    function copyText() {
        isCopyAnimActive = true;

        navigator.clipboard.writeText(this.innerText).catch(
            (err) => { console.error("Async: Could not copy text: ", err) }
        );

        setTimeout(() => {
            isCopyAnimActive = false;
        }, 800);
    }

    // broadcast the cached watchers list to everyone
    function broadcastOnlineWatchers() {
        if (!connectionsHandler.isHost) return;

        // if executed from radio input
        if (this) {
            watchers = watchers.map((item) => {
                if (item.name == this.getAttribute("watcher")) {
                    item.controlLevel = parseInt(this.value);
                }
                return item;
            });
        }

        const message = {
            type: "users",
            from: $uid,
            content: watchers,
        };

        connectionsHandler.broadcast(JSON.stringify(message));
    }

    async function changeAndBroadcastControlState(n) {
        let twin = {
            0: 3, //left
            1: 2, //right
            2: 1, //up
            3: 0, //down
            4: 5, //horizontal left
            5: 4, //horizontal right
        };

        let directionRef = database.ref(`users/${$uid}/direction`);

        let directions = await directionRef.get();
        directions = directions.val() || [0, 0, 0, 0,  0, 0];
        directions[n] = directions[n] == 1 ? 0 : 1;
        if (directions[twin[n]] == 1)
            directions[twin[n]] = directions[n] == 1 ? 0 : 1;

        directionRef.set(directions);

        /*
         * const message = {
         *     type: "controlsState",
         *     from: connectionsHandler.peer.id,
         *     content: directions,
         *     displayName: $username,
         * };
         * connectionsHandler.broadcast(JSON.stringify(message));
         */
        setActiveMarker("");
    }
    
    const isHost = $username.length == 0 

    // if there's a 'username'  means the user choose to connect to someone else camera
    if (isHost == false) {
        // setup the peer connection as watcher
        connectToHost(
            $username,
            (remoteStream) => {
                videoEl.srcObject = remoteStream;
            },
            (data) => {
                if (connectionsHandler.isHost) return;

                if (data.type == "users") {
                    watchers = data.content;
                    const me = watchers.filter((item) => item.id == $uid);

                    if (!me.length){
                        connectionsHandler.peer.disconnect();
                        return
                    }

                    if (me[0].controlLevel > 1) {
                        setCubesState("btnMode");
                    } else {
                        setCubesState("floatOpening");
                    }
                }

                switch(data.type){
                    case "currentPercentage":
                        currentPercentage = data.content;
                        break
                    case "horizontalPercentage":
                        horizontalPercentage = data.content;
                        break
                    case "fixedPositions":
                        markers = data.content;
                        break
                    case "controlsState":
                        buttonsState.update(() => {
                            return data.content.map(item => item ? true : false);
                        });
                        break
                    case "votation":
                        votations = data.content
                        break
                }

            }
        );

        // send to host the camera buttons I have pressed
        controlsBtn.assignFunction("main", (n) => {
            if (typeof n != "number") return;

            const message = {
                type: "controls",
                from: connectionsHandler.peer.id,
                content: n,
                displayName: auth.currentUser.displayName,
            };

            connectionsHandler.broadcast(JSON.stringify(message));
        });

    } else if(isHost == true) {
        setCubesState("btnMode");

        // Broadcast through WebRTC any currentPercent or horizontalPercentage changes on the server
        // and synchronize the currentPercent with the server
        let currentPercentageRef = database.ref(
            `users/${$uid}/currentPercentage`
        );
        currentPercentageRef.on("value", (snapshot) => {
            if (!snapshot.val()) return;
            const message = {
                type: "currentPercentage",
                from: connectionsHandler.peer.id,
                content: snapshot.val(),
                displayName: $username,
            };
            connectionsHandler.broadcast(JSON.stringify(message));
            currentPercentage = snapshot.val();
        });


        let horizontalPercentageRef = database.ref(
            `users/${$uid}/horizontalPercentage`
        );
        horizontalPercentageRef.on("value", (snapshot) => {
            if (!snapshot.val()) return;
            const message = {
                type: "horizontalPercentage",
                from: connectionsHandler.peer.id,
                content: snapshot.val(),
                displayName: $username,
            };
            connectionsHandler.broadcast(JSON.stringify(message));
            horizontalPercentage = snapshot.val();
        });

        // Listen the fixedPositions in the server and update the local ones
        let fixedPositionsRef = database.ref(`users/${$uid}/fixedPositions`);
        fixedPositionsRef.on("value", (snapshot) => {
            const positions = snapshot.val();
            if (!positions) return;
            console.log(positions);

            let currentMarkerNames = positions.map((marker) => marker.name);
            let markerNames = markers.map((marker) => marker.name);
            if (
                markerNames.sort().join("") !==
                currentMarkerNames.sort().join("")
            ) {
                markers = [];

                markers = positions.map(({name, percentage}) => ({
                    name,
                    percentage,
                    tooltip: { isVisible: false, timeout: null },
                })
                )
            }

            // Broadcast the fixedPositions through WebRTC
            const message = {
                type: "fixedPositions",
                from: connectionsHandler.peer.id,
                content: markers,
                displayName: $username,
            };
            connectionsHandler.broadcast(JSON.stringify(message));
        });

        // update the buttonsState when the server data changes
        let directionRef = database.ref(`users/${$uid}/direction`);
        directionRef.on("value", (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            console.log(data);

            buttonsState.update(() => {
                return data.map(item => item ? true : false);
            });

            let message = {
                type: "controlsState",
                from: connectionsHandler.peer.id,
                content: $buttonsState.map((item) => (item ? 1 : 0)),
                displayName: $username,
            };
            connectionsHandler.broadcast(JSON.stringify(message));
        });

        controlsBtn.assignFunction("main", async (n) => {
            changeAndBroadcastControlState(n);
        });


        // Setup the peer connection as host
        setupAsHost(
            (localStream) => {
                videoEl.srcObject = localStream;

                console.log('loading ML models...')

                Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri('./dist/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('./dist/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('./dist/models'),
                    faceapi.nets.faceExpressionNet.loadFromUri('./dist/models'),
                ]).then(() => {

                    console.log('ML models loaded!')

                    const canvas = faceapi.createCanvasFromMedia(videoEl)
                    let displaySize = { width: canvas.width, height: canvas.height }
                    canvas.id = 'webcamVideo' 
                    videoEl.parentNode.prepend(canvas)
                    videoEl.style.height = '100%'
                    canvas.style.height = '100%'
                    videoEl.parentNode.style.height = `max(min(calc(45vw*(${canvas.height}/${canvas.width})), calc(80vh*(${canvas.height}/${canvas.width}))),calc(29vh*(${canvas.height}/${canvas.width})))`

                    canvas.style.position = 'absolute'
                    
                    const directionLeftRef = database.ref(`users/${$uid}/direction/2`);
                    const directionRightRef = database.ref(`users/${$uid}/direction/1`);
                    const directionUpRef = database.ref(`users/${$uid}/direction/0`);
                    const directionDownRef = database.ref(`users/${$uid}/direction/3`);

                    setInterval(async () => {
                        if($facetrackOn == false){
                            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
                            return
                        }

                        if(displaySize.width == 0 || displaySize.height == 0 ){
                            console.log('zero')
                            displaySize = { width: canvas.width, height: canvas.height }
                            return
                        }
                        const detections = await faceapi.detectAllFaces(videoEl,
                            new faceapi.TinyFaceDetectorOptions({
                                scoreThreshold: 0.1
                            }))
                        if(detections.length){
                            const wcenter = detections[0].box.left + detections[0].box.width/2
                            const hcenter = detections[0].box.top + detections[0].box.height/2
                            const wrelative = wcenter-canvas.width/2
                            const hrelative = canvas.height/2-hcenter
                            const wthreshold = canvas.width/5
                            const hthreshold = canvas.height/5


                            if(wrelative > wthreshold){
                                directionRightRef.set(1)
                                directionLeftRef.set(0)
                            }else if(wrelative < -wthreshold){
                                directionRightRef.set(0)
                                directionLeftRef.set(1)
                            }else{
                                directionRightRef.set(0)
                                directionLeftRef.set(0)
                            }


                            if(hrelative > hthreshold){
                                directionUpRef.set(1)
                                directionDownRef.set(0)
                            }else if(hrelative < -hthreshold){
                                directionUpRef.set(0)
                                directionDownRef.set(1)
                            }else{
                                directionUpRef.set(0)
                                directionDownRef.set(0)
                            }

                            console.log({wrelative, hrelative})
                            /* console.log(detections[0].box()) */
                        }
                        

                        const resizedDetections = faceapi.resizeResults(detections, displaySize)

                        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
                        faceapi.draw.drawDetections(canvas, resizedDetections)
                    }, 100)
                })



            },
            (data) => {
                // make sure that I'm the host, if not, do nothing
                if (!connectionsHandler.isHost || !data) return;

                let isFromTrustedWatcher = null;
                
                // when the handshake message is received, send the current controlsState, fixedPositions and currentPercentage
                switch(data.type){
                    case "handshake":
                        let message = {
                            type: "controlsState",
                            from: connectionsHandler.peer.id,
                            content: $buttonsState.map((item) => (item ? 1 : 0)),
                            displayName: $username,
                        };
                        connectionsHandler.broadcast(JSON.stringify(message));

                        // send fixedPositions through WebRTC
                        message = {
                            type: "fixedPositions",
                            from: connectionsHandler.peer.id,
                            content: markers,
                            displayName: $username,
                        };
                        connectionsHandler.broadcast(JSON.stringify(message));

                        // send currentPercentage through WebRTC
                        message = {
                            type: "currentPercentage",
                            from: connectionsHandler.peer.id,
                            content: currentPercentage,
                            displayName: $username,
                        };
                        connectionsHandler.broadcast(JSON.stringify(message));
                        break
                    case "activeMarker":
                        isFromTrustedWatcher =
                            watchers.filter(
                                (item) => item.id == data.from && item.controlLevel >= 1
                            ).length == 1 ? true : false;

                        if(isFromTrustedWatcher) 
                            activeMarker = data.content
                        break
                    case "votation":
                        if(markers.filter(item => item.name == data.content.name).length >= 1)
                            addVotation(data.content.name, data.content.votes.length ? [data.content.votes[0]] : [])
                        break
                    case "addMarker":
                        isFromTrustedWatcher =
                            watchers.filter(
                                (item) => item.id == data.from && item.controlLevel == 2
                            ).length == 1 ? true : false;

                        if(isFromTrustedWatcher){
                            addMarker(data.content.name, data.content.percentage)
                        } 
                        break
                    case "removeMarker":
                        isFromTrustedWatcher =
                            watchers.filter(
                                (item) => item.id == data.from && item.controlLevel == 2
                            ).length == 1 ? true : false;

                        if(isFromTrustedWatcher){
                            removeCurrentFixedPosition()
                        } 

                        break
                    case "controls":
                        isFromTrustedWatcher =
                            watchers.filter(
                                (item) => item.id == data.from && item.controlLevel == 2
                            ).length == 1 ? true : false;
                        if (!isFromTrustedWatcher) return;

                        const n = data.content;

                        changeAndBroadcastControlState(n);
                        break
                }

                // update online watchers
                let sameItems = [];
                let newItems = [];
                let extraItems = Array.from(watchers);

                for (let connection of connectionsHandler.connections) {
                    extraItems = extraItems.filter(
                        (item) => item.id != connection.id
                    );
                    let found = false;
                    for (let watcher of watchers) {
                        if (watcher.id == connection.id) {
                            found = true;
                            sameItems.push(
                                Object.assign(
                                    { controlLevel: watcher.controlLevel },
                                    connection
                                )
                            );
                            break;
                        }
                    }
                    if (found) continue;

                    newItems.push(connection);
                }

                watchers = [];

                for (let item of [...sameItems, ...newItems]) {
                    watchers = [
                        ...watchers,
                        {
                            name: item.displayName,
                            id: item.id,
                            // @ts-ignore
                            controlLevel:
                                typeof item.controlLevel == "number"
                                    ? item.controlLevel
                                    : 1,
                        },
                    ];
                }

                // if there someone new, send this information to all other watchers
                if (newItems.length || extraItems.length) {
                    broadcastOnlineWatchers();
                }
            }
        );
    }

    let watchers = [];
    let isSlidePanelOpen = false;
    let isCopyAnimActive = false;

    let isCopyPanelActive = false;
    let copyPanelTimeout = null;
    let slidePanelTimeout = null;

    let markers = [
        /*
         * {
         *     name: "inicio",
         *     percentage: 20,
         *     tooltip: { isVisible: false, timeout: null },
         * },
         * {
         *     name: "meio",
         *     percentage: 50,
         *     tooltip: { isVisible: false, timeout: null },
         * },
         * {
         *     name: "fim",
         *     percentage: 80,
         *     tooltip: { isVisible: false, timeout: null },
         * },
         */
    ];

    let currentPercentage = 0;
    let horizontalPercentage = 50;

    const addMarker = async (markerName, markerPercentage) => {
        if(!markerName) return 
        const newMarker = {
            name: markerName,
            percentage: markerPercentage,
            tooltip: { isVisible: false, timeout: null },
        }

        if($username.length != 0){

            const message = {
                type: "addMarker",
                from: connectionsHandler.peer.id,
                content: newMarker,
                displayName: auth.currentUser.displayName,
            };

            connectionsHandler.broadcast(JSON.stringify(message));
            return
        }




        if(markers.filter(item => item.name == markerName).length){
            markers = markers.map((item) => {
                if(item.name != markerName) return item

                return {...item, percentage: markerPercentage}
            })
        }else{
            markers = [...markers, newMarker]
        }            

        const message = {
            type: "fixedPositions",
            from: connectionsHandler.peer.id,
            content: markers,
            displayName: $username,
        };
        connectionsHandler.broadcast(JSON.stringify(message));

        /*
         * markers = [
         *     ...markers,
         *     newMarker,
         * ];
         */
        console.log(markers);

        /*myobject[randomLetter(5)] = Math.floor(Math.random()*100)*/
        const newMarkers = markers.map(({ name, percentage }) => {
            return { name, percentage };
        });

        let fixedPositionsRef = database.ref(`users/${$uid}/fixedPositions`);

        fixedPositionsRef.set(newMarkers);
    };

    const offset = 4;
    function removeCurrentFixedPosition() {

        if($username.length != 0){

            const message = {
                type: "removeMarker",
                from: connectionsHandler.peer.id,
                content: null,
                displayName: auth.currentUser.displayName,
            };

            connectionsHandler.broadcast(JSON.stringify(message));
            return
        }


        let foundIndexes = [];
        const currentMarkers = markers.filter(
            (item) =>
                item.percentage + offset > currentPercentage &&
                item.percentage - offset < currentPercentage
        );
        for (let [i, marker] of Object.entries(markers)) {
            if (
                marker.percentage + offset > currentPercentage &&
                marker.percentage - offset < currentPercentage
            ) {
                foundIndexes.push(parseInt(i));
            }
        }
        console.log(foundIndexes);

        if (foundIndexes.length) {
            markers = markers.filter(
                (item) => item.name != markers[foundIndexes[0]].name
            );
            let fixedPositionsRef = database.ref(
                `users/${$uid}/fixedPositions`
            );
            const newMarkers = markers.map(({ name, percentage }) => {
                return { name, percentage };
            });
            fixedPositionsRef.set(markers);
        }
    };

    let editActive = false;
    let newMarkerName = "";
    let editRemoveName = "";
    let activeMarker = "";

function setActiveMarker(name){
    if($username.length != 0){
        if(name == '') return
        const message = {
            type: "activeMarker",
            from: connectionsHandler.peer.id,
            content: name,
            displayName: auth.currentUser.displayName,
        };

        connectionsHandler.broadcast(JSON.stringify(message));
        return
    }

    activeMarker = name
}
    let sliderValue = 50

    function listenActiveMarker() {
        if (activeMarker) {
            const marker = markers.filter((item) => item.name == activeMarker);
            if (!marker.length) return;

            if (Math.abs(marker[0].percentage - currentPercentage) <= 5) {
                let directionRef = database.ref(`users/${$uid}/direction`);
                directionRef.set([0, 0, 0, 0,  0, 0]);
                setActiveMarker("");
                return;
            }

            let directionRightRef = database.ref(`users/${$uid}/direction/1`);
            let directionLeftRef = database.ref(`users/${$uid}/direction/2`);

            if (marker[0].percentage - currentPercentage < 0) {
                directionRightRef.set(0);
                directionLeftRef.set(1);
            } else {
                directionRightRef.set(1);
                directionLeftRef.set(0);
            }
        }
    }

    setInterval(listenActiveMarker, 200);


    function listenHorizontalPercentage() {
        if (Math.abs(sliderValue - horizontalPercentage) > 5) {

            let directionRightRef = database.ref(`users/${$uid}/direction/4`);
            let directionLeftRef = database.ref(`users/${$uid}/direction/5`);

            if (sliderValue - horizontalPercentage < 0) {
                directionRightRef.set(0);
                directionLeftRef.set(1);
            } else {
                directionRightRef.set(1);
                directionLeftRef.set(0);
            }
        }else{
            let directionRef = database.ref(`users/${$uid}/direction`);
            directionRef.get().then((snapshot) => {
                let data = snapshot.val()
                if(!data) return
                data[4] = 0
                data[5] = 0
                directionRef.set(data);
                
            })
        }
    }

    setInterval(listenHorizontalPercentage, 200);

    $: meWatcher = watchers.filter((item) => item.id == $uid);

    let i;
    $: if (
        (i = markers.filter(
            (item) =>
                item.percentage + offset > currentPercentage &&
                item.percentage - offset < currentPercentage
        )) &&
        i.length
    ) {
        editRemoveName = i[0].name;
    } else {
        editRemoveName = "";
    }

    let votations = [ 
        /*
         * {
         *     name: "Item 1",
         *     time: 10, // 100%
         *     votes: 4,
         *     maxVotes: 10,
         * },
         * {
         *     name: "Item 2",
         *     time: 70, // 100%
         *     votes: 7,
         *     maxVotes: 10,
         * }
         */
    ]

const updateVotations = () => {
    if(votations.length == 0) return

    for(let i = votations.length-1; i >= 0; i--){
        votations[i].time+=10
        if(votations[i].votes.length >= votations[i].maxVotes){
            activeMarker = votations[i].name
            votations.splice(i,1)
        }else if(votations[i].time > 100){
            votations.splice(i,1)
        }
    }
}

function addVotation(name, votes=[]){

    // As a watcher
    if($username.length != 0){
        const message = {
            type: "votation",
            from: connectionsHandler.peer.id,
            content: {name, votes: votes.length ? votes[0] : []},
            displayName: auth.currentUser.displayName,
        };
        connectionsHandler.broadcast(JSON.stringify(message))
        return
    }

    const newVotation = {
        name,
        time: 0,
        votes: [],
        maxVotes: Math.floor(watchers.length/2)||1 
    }
    if(votations.filter(item => item.name == name).length){

        votations = votations.map((item) => {
            if(item.name != name) return item

            return {...item, votes: votes.length ? [...item.votes, votes[0]] : item.votes}
        })
    }else{
        votations.push(newVotation)
    }

    const message = {
        type: "votation",
        from: connectionsHandler.peer.id,
        content: votations,
        displayName: auth.currentUser.displayName,
    };
    connectionsHandler.broadcast(JSON.stringify(message))

    updateVotations()

}

setInterval(updateVotations, 5000)

</script>

<div class="flexColumn" style="align-items: baseline">
    <div class="videoContainer">
        <video id="webcamVideo" autoplay playsinline bind:this={videoEl} />
    </div>
    <div style="width:100%; height: 20px">
        <div class="positionBarContainer">
            <div
                class="currentPosition"
                style="--percentage: {currentPercentage}"
            />

            {#each markers as { percentage, name, tooltip }}
                <div
                    class="marker"
                    style="--percentage: {percentage}"
                    on:mouseenter={() => {
                        clearTimeout(tooltip.timeout);
                        tooltip.isVisible = true;
                    }}
                    on:mouseleave={() => {
                        tooltip.timeout = setTimeout(() => {
                            tooltip.isVisible = false;
                        }, 500);
                    }}
                    on:click={() => {
                    if(meWatcher.length && meWatcher[0].controlLevel == 1){
                        addVotation(name, [auth.currentUser.displayName])
                    }else if(connectionsHandler.isHost || (meWatcher.length && meWatcher[0].controlLevel >0) ){
                        setActiveMarker(name);
                    }
                    }}
                >
                    <div
                        class="marker-tooltip"
                        class:active={tooltip.isVisible}
                    >
                        {name}
                    </div>
                </div>
            {/each}
        </div>
    </div>
    {#if connectionsHandler.isHost || (meWatcher.length && meWatcher[0].controlLevel == 2)}
        <div class="editionBar" style="width: 100%">
            <div class="flexRow" style="height: 20px; margin: 5px 0;">
                <input
                    type="text"
                    class="transparentInput"
                    style="flex: 1; "
                    placeholder="Digite Aqui"
                    bind:value={newMarkerName}
                    on:keypress={(e) => {
                        if (e.key == "Enter"){
                            addMarker(
                                newMarkerName,
                                currentPercentage
                                /* Math.floor(Math.random() * 100) */
                            );
                            newMarkerName = ""
                        }
                    }}
                />
                <button
                    class="transparentBtn editItem"
                    on:click={() => {
                        addMarker(
                            newMarkerName,
                            currentPercentage
                            /* Math.floor(Math.random() * 100) */
                        );
                        newMarkerName = ""
                    }}>Adicionar Marcador</button
                >
            </div>
            <div>
                {#if editRemoveName}
                    <button
                        class="transparentBtn removeItem"
                        on:click={removeCurrentFixedPosition}
                    >
                        <p>Remover {editRemoveName}</p>
                    </button>
                {/if}
            </div>
        </div>

        <div class="slidebarContainer">
            <div class="shadow" style={`--percentage: ${horizontalPercentage}%`} ></div>
            <input type="range" bind:value={sliderValue}>
        </div>
    {/if}
</div>
<div class="floatingIcons">
    <div on:click={() => (isCopyPanelActive = !isCopyPanelActive)}>
        <i class="fas fa-share fa-2x" />
    </div>
    <div on:click={() => (isSlidePanelOpen = !isSlidePanelOpen)}>
        <i class="fas fa-user-friends fa-2x" />
    </div>
</div>

<div
    class="slideFromRightContainer"
    class:open={isSlidePanelOpen}
    on:mouseleave={() => {
        slidePanelTimeout = setTimeout(() => {
            isSlidePanelOpen = false;
        }, 300);
    }}
    on:mouseenter={() => clearTimeout(slidePanelTimeout)}
>
    <h2>Participantes</h2>
    <div class="listHeader">
        <span>Nome</span>
        <span>Nível de Controle</span>
    </div>
    <ul>
        {#each watchers as watcher}
            <li>
                <span class:me={watcher.id == $uid}>{watcher.name}</span>
                <div
                    style={`pointer-events: ${
                        connectionsHandler.isHost ? "auto" : "none"
                    }`}
                >
                    <input
                        on:change={broadcastOnlineWatchers}
                        watcher={watcher.name}
                        type="radio"
                        bind:group={watcher.controlLevel}
                        value={0}
                    />
                    <input
                        on:change={broadcastOnlineWatchers}
                        watcher={watcher.name}
                        type="radio"
                        bind:group={watcher.controlLevel}
                        value={1}
                    />
                    <input
                        on:change={broadcastOnlineWatchers}
                        watcher={watcher.name}
                        type="radio"
                        bind:group={watcher.controlLevel}
                        value={2}
                    />
                </div>
            </li>
        {/each}
    </ul>
</div>

{#if isCopyPanelActive}
    <div
        class="copyPanel"
        transition:fade
        on:mouseleave={() => {
            copyPanelTimeout = setTimeout(() => {
                isCopyPanelActive = false;
            }, 300);
        }}
        on:mouseenter={() => clearTimeout(copyPanelTimeout)}
    >
        <h2>
            compartilhe o código abaixo para outras pessoas entrarem na sua
            chamada
        </h2>
        <div>
            <span>clique para copiar</span>
            <div>
                <p on:click={copyText} class:active={isCopyAnimActive}>
                    {$username.length ? $username : $uid}
                </p>
            </div>
        </div>
    </div>
{/if}

{#if votations.length}
    <div class="votations" transition:fade>
      <h3>Votações Ativas</h3>
      <ul>
        {#each votations as {name, time, votes, maxVotes} }
            <li on:click={() => { addVotation(name, [auth.currentUser.displayName]) }}>
              <div class="timer">
                <svg width="50" height="50" viewBox="0 0 100 100">
                  <defs>
                    <clipPath id="clipPath-{name.replace(' ' ,'-')}">
                    <rect x="0" y="{Math.floor(100-votes.length/maxVotes*100)}" width="100" height="100"></rect>
                    </clipPath>
                  </defs>
                  
                  <circle class="progressFill" cx="50" cy="50" r="45" style=" clip-path: url(#clipPath-{name.replace(' ' ,'-')}); "></circle>

                  <circle class="progressLine" stroke-linecap="round" cx="50" cy="50" r="45" stroke-width="7" fill="none" stroke-dasharray="315" stroke-dashoffset="{Math.floor(315-time/100*315)}" stroke-mitterlimit="0" transform="rotate(-90 ) translate(-100 0)"></circle>
                </svg>
                <span class="svgText">{votes.length}</span>
              </div>
              <p>{name}</p>
            </li>
        {/each}
      </ul>
    </div>
{/if}

<style>
    .videoContainer {
        /* --size: 90%;
            width: var(--size); */
        position: relative;
        width: 100%;
        /* height: var(--size); */
        /* margin-bottom: 1.5rem; */
        max-width: 80vh;
        background: #2c3e50;
    }

    .videoContainer video {
        height: 35vw
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
        right: calc(-1 * var(--width));
        transition: right 0.5s;
        top: 0;
        z-index: 4;
    }

    .slideFromRightContainer.open {
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

    input[type="radio"] {
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

    .slideFromRightContainer input:nth-child(1):checked {
        background-color: red;
        border-color: red;
    }
    .slideFromRightContainer input:nth-child(2):checked {
        background-color: white;
        border-color: white;
    }
    .slideFromRightContainer input:nth-child(3):checked {
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
        width: clamp(200px, 70vw, 400px);
        padding: 10px;
        position: fixed;
        background-color: #782299;
        box-shadow: 0px 0px 20px 5px #4f194fb3;
        top: 60px;
        right: clamp(20px, calc(100vw - 400px), 90px);
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
        font-size: clamp(0.7rem, 4vw, 1rem);
    }

    .copyPanel div p::before {
        content: "Copiado";
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
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
        100% {
            opacity: 0;
        }
    }

    .positionBarContainer {
        width: 100%;
        height: 15px;
        background-color: #a32ad0cf;
        position: relative;
        border: #87249c solid 1px;
        border-top: none;
        opacity: 0.5;
        transition: height 0.2s ease-out 1s, opacity 0.2s ease-out 1s;
        --percentage: 0;
    }

    .positionBarContainer:hover {
        height: 20px;
        opacity: 1;
        transition: height 0.2s ease-in 0s, opacity 0.2s ease-in 0s;
    }

    .currentPosition {
        background-color: #5b1a6d;
    }

    .currentPosition,
    .marker {
        transition: left 0.1s, background-color 0.1s;
        height: inherit;
        position: absolute;
        width: 15px;
        left: calc(var(--percentage) / 100 * (100% - 15px));
    }

    .marker {
        /*background-color: transparent;*/
        background-color: red;
        border: #80149e solid var(--border);
        height: calc(100% - var(--border) * 2 + 1px);
        --border: 2px;
        cursor: pointer;
    }

    .marker:hover {
        background-color: #80149e;
    }

    .marker-tooltip.active,
    .marker-tooltip.active::after {
        pointer-events: auto;
        opacity: 1;
    }

    .marker-tooltip {
        max-width: 120px;
        padding: 10px;
        color: white;
        background-color: #2c3e50;
        position: absolute;
        bottom: calc(100% + 5px);
        text-align: center;
        border-radius: 4px;
        transition: opacity 0.2s;

        pointer-events: none;
        opacity: 0;
        cursor: default;
    }

    .marker-tooltip::after {
        content: " ";
        position: absolute;
        border-width: 5px;
        border-style: solid;
        border-color: #2c3e50 transparent #f9080800 #2c3e50;
        transition: opacity 0.2s;
        bottom: -5px;
        left: 0;
        pointer-events: none;
        opacity: 0;
    }

    .editionBar > div.flexRow * {
        border-radius: 0;
        height: 100%;
    }

    .editionBar > div.flexRow button {
        border: 1px solid #ffffff45;
        width: auto;
    }

    .editionBar .editItem {
        color: #fff;
        cursor: pointer;
    }

    .editionBar .removeItem.transparentBtn:hover {
        box-shadow: 0px 0px 20px rgba(255, 0, 0, 0.32);
    }

    .editionBar .removeItem {
        background: rgba(157, 13, 13, 0.71);
        border-color: #ff0000b3;
        cursor: pointer;
        height: 30px;
    }

    .editionBar .removeItem p {
        color: #ff9393;
    }

    .editionBar {
        opacity: 0;
        transition: height 0.2s ease-out 1s, opacity 0.2s ease-out 1s;
    }

    span.me {
        font-weight: bold;
    }

    .editionBar:hover,
    .editionBar:focus-within {
        opacity: 1;
        transition: height 0.2s ease-in 0s, opacity 0.2s ease-in 0s;
    }


    /* Votation */

.votations h3 {
  color: white;
        text-align: center;
}

.votations {
  background: rgba(255,255,255,0.15);
  width: 20vw;
max-width: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 5px 5px;
  font-family: sans-serif;
    right: calc(-20vw - 25px);
        position: absolute;
}

.votations ul {
  padding: 0;
  width: 100%;
}

.votations li {
  padding: 3px 0;
  margin: auto;
  display: flex;
  flex-direction: row;
  height: 50px;
  justify-content: center;
  align-items: center;
  margin-bottom: 5px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.votations li:hover {
  background: #ffffff50;
}

.timer .svgText {
  font-size: 1.5em;
  text-align: center;
  position: absolute;
  color: black;
  font-weight: bold;
}

.timer .progressFill {
  fill: rgba(255,255,255,0.5);
}

.timer .progressLine {
  stroke: white
}

.votations li .timer {
  width: 50px;
  height: 100%;
  display: grid;
  place-items: center;
  background: none;
}

.votations li>p {
  width: auto;
  margin: 0;
  padding: 0px 10px;
}


.slidebarContainer {
  width: 100%;
  display: flex;
  height: 10px;
  position: relative;
  margin-top: 20px;
}

.slidebarContainer input {
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 100%;
  background-color: rgb(201, 144, 242);
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  z-index: 0;
}

.slidebarContainer input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  border: solid rgba(255,255,255,0.7) 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgb(113,0,228);
  cursor: pointer;
}

.slidebarContainer input::-moz-range-thumb {
  -webkit-appearance: none;
  appearance: none;
  border: solid rgba(255,255,255,0.7) 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgb(113,0,228);
  cursor: pointer;
}

.slidebarContainer .shadow {
  /* border: solid rgb(201, 144, 242) 2px; */
  width: 20px;
  height: 20px;
  border-radius: 50%;
  margin-top: -5px;
  background-color: rgb(201, 144, 242);
  position: absolute;
  margin-left: calc(var(--percentage) - 21px)
  
}

</style>
