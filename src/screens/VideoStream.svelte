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
    import { configBtn } from "../stores/header";
    import { uid } from "../stores/app.js";
    import { fade } from "svelte/transition";
    import { database, auth } from "../firebase";

    configBtn.assignFunction("main", () => {
        console.log("%cPARECE QUE FOI!", "color: purple;font-size: 20px");
    });

    let videoEl = null;

    function copyText() {
        isCopyAnimActive = true;

        navigator.clipboard.writeText(this.innerText).then(
            function () {},
            function (err) {
                console.error("Async: Could not copy text: ", err);
            }
        );

        setTimeout(() => {
            isCopyAnimActive = false;
        }, 800);
    }

    // broadcast the cached watchers list to everyone
    function broadcastOnlineWatchers() {
        if (!connectionsHandler.isHost) return;

        if (this) {
            watchers = watchers.map((item) => {
                if (item.name == this.getAttribute("watcher")) {
                    item.controlLevel = parseInt(this.value);
                    return item;
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
            0: 3,
            1: 2,
            2: 1,
            3: 0,
        };

        let directionRef = database.ref(`users/${$uid}/direction`);

        let directions = await directionRef.get();
        directions = directions.val() || [0, 0, 0, 0];
        directions[n] = directions[n] == 1 ? 0 : 1;
        if (directions[twin[n]] == 1)
            directions[twin[n]] = directions[n] == 1 ? 0 : 1;

        directionRef.set(directions);

        const message = {
            type: "controlsState",
            from: connectionsHandler.peer.id,
            content: directions,
            displayName: $username,
        };
        connectionsHandler.broadcast(JSON.stringify(message));
    }

    // if there's a 'username'  means the user choose to connect to someone else camera
    if ($username.length != 0) {
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

                    let me = watchers.filter((item) => item.id == $uid);

                    if (me.length) {
                        if (me[0].controlLevel > 0) {
                            setCubesState("btnMode");
                        } else {
                            setCubesState("floatOpening");
                        }
                    } else {
                        connectionsHandler.peer.disconnect();
                    }
                }

                if (data.type == "currentPercentage") {
                    currentPercentage = data.content;
                }

                if (data.type == "fixedPositions") {
                    markers = data.content;
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

        // change my buttons state when the host send a message of type 'controlsState'
        connectionsHandler.subscribeToAll("data", async (rawData) => {
            try {
                let data = JSON.parse(rawData);

                if (data.type == "controlsState") {
                    buttonsState.update((prevState) => {
                        for (let i = 0; i < data.content.length; i++) {
                            prevState[i] = data.content[i] ? true : false;
                        }
                        return prevState;
                    });
                }
            } catch (err) {}
        });
    } else {
        setCubesState("btnMode");

        // Broadcast through WebRTC any currentPercent changes on the server
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
                for (let { name, percentage } of positions) {
                    markers.push({
                        name,
                        percentage,
                        tooltip: { isVisible: false, timeout: null },
                    });
                }
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

            buttonsState.update((prevState) => {
                for (let i = 0; i < data.length; i++) {
                    prevState[i] = data[i] ? true : false;
                }
                return prevState;
            });
        });

        controlsBtn.assignFunction("main", async (n) => {
            changeAndBroadcastControlState(n);
        });

        // when receive a command to change the buttonsState from user with enough control acess, change and broadcast that command
        connectionsHandler.subscribeToAll("data", (rawData) => {
            try {
                let data = JSON.parse(rawData);

                if (data.type == "controls") {
                    let isFromTrustedWatcher =
                        watchers.filter(
                            (item) =>
                                item.id == data.from && item.controlLevel > 0
                        ).length == 1
                            ? true
                            : false;
                    if (!isFromTrustedWatcher) return;

                    let n = data.content;

                    changeAndBroadcastControlState(n);
                }
            } catch (err) {}
        });

        // Setup the peer connection as host
        setupAsHost(
            (localStream) => {
                videoEl.srcObject = localStream;
            },
            (data) => {
                // make sure that I'm the host, if not, do nothing
                if (!connectionsHandler.isHost) return;

                // when the handshake message is received, send the current controlsState, fixedPositions and currentPercentage
                if (data && data.type == "handshake") {
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
        {
            name: "inicio",
            percentage: 20,
            tooltip: { isVisible: false, timeout: null },
        },
        {
            name: "meio",
            percentage: 50,
            tooltip: { isVisible: false, timeout: null },
        },
        {
            name: "fim",
            percentage: 80,
            tooltip: { isVisible: false, timeout: null },
        },
    ];

    let currentPercentage = 35;

    window.changePercentage = (num) => {
        currentPercentage = num;
    };

    const addFixedPosition = async (markerName, markerPercentage) => {
        let fixedPositionsRef = database.ref(`users/${$uid}/fixedPositions`);

        markers = [
            ...markers,
            {
                name: markerName,
                percentage: markerPercentage,
                tooltip: { isVisible: false, timeout: null },
            },
        ];
        console.log(markers);

        /*myobject[randomLetter(5)] = Math.floor(Math.random()*100)*/
        const newMarkers = markers.map(({ name, percentage }) => {
            return { name, percentage };
        });

        fixedPositionsRef.set(newMarkers);
    };

    const offset = 4;
    const removeCurrentFixedPosition = () => {
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

    $: meWatcher = watchers.filter((item) => item.id == $uid)

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
</script>

<div class="flexColumn" style="align-items: baseline">
    <video id="webcamVideo" autoplay playsinline bind:this={videoEl} />
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
                        if (e.key == "Enter")
                            addFixedPosition(
                                newMarkerName,
                                currentPercentage
                                /* Math.floor(Math.random() * 100) */
                            );
                    }}
                />
                <button
                    class="transparentBtn editItem"
                    on:click={() => {
                        addFixedPosition(
                            newMarkerName,
                            currentPercentage
                            /* Math.floor(Math.random() * 100) */
                        );
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

<style>
    video#webcamVideo {
        /* --size: 90%;
            width: var(--size); */
        width: 100%;
        /* height: var(--size); */
        /* margin-bottom: 1.5rem; */
        max-width: 80vh;
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
</style>
