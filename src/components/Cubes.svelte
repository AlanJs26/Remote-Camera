<script context="module">
    import { tweened } from "svelte/motion";
    import { cubicOut, cubicInOut, linear } from "svelte/easing";
    import { writable } from 'svelte/store';
    import {cubeSize as cubeProperties, controlsBtn} from '../stores/cubes'
    import {loggedState, uid, currentScreen} from '../stores/app.js'
    import { database } from '../firebase';


    const animVal = tweened(
        { x: 0, y: 0 },
        {
            duration: 5000,
            // easing: cubicOut
        }
    );
    const animVal2 = tweened(
        { x: 0, y: 0 },
        {
            duration: 5000,
            // easing: cubicOut
        }
    );

    let animationState = "floatOpening";
    const btnModeClass = writable(false);
    const absolutePosition = writable({x: 0, y: 0})

    function floatAnimIntervalParser(x, y) {
        animVal.update((value) => {
            return { x: x, y: value.y + 1 };
        });
        animVal2.update((value) => {
            return { x: x, y: value.y + 1 };
        });
    }

    function AnimVal2cubes(value, value2) {
        let toSine = (v) => {
            return parseFloat((Math.sin(v) * 100).toFixed(4));
        };
        let toCosine = (v) => {
            return parseFloat((Math.cos(v) * 100).toFixed(4));
        };

        switch (animationState) {
            case "floatOpening":

                return [
                    { x: `-33vw`, y: `${toCosine(value.y)                - 70 + 100}px` },
                    { x: `-33vw`, y: `${  toSine(value2.y + Math.PI / 6) - 70 - 100}px` },
                    { x: ` 33vw`, y: `${toCosine(value.y)                - 70 + 100}px` },
                    { x: ` 33vw`, y: `${  toSine(value2.y + Math.PI / 6) - 70 - 100}px` },
                ];
                break;
            case "btnMode":
                return [
                    { x: '0', y: '0' },
                    { x: '0', y: '0' },
                    { x: '0', y: '0' },
                    { x: '0', y: '0' },
                ];
                break;
            default:
                return [
                    { x: '0', y: '0' },
                    { x: '0', y: '0' },
                    { x: '0', y: '0' },
                    { x: '0', y: '0' },
                ];
                break;
        }
    }

    let floatInterval;
    export function setCubesState(state) {
        animationState = state;

        if (state != "floatOpening") {
            animVal.set({ x: 0, y: 0 });
            animVal2.set({ x: 0, y: 0 });
            clearInterval(floatInterval);
        }

        switch (state) {
            case "floatOpening":
                btnModeClass.set(false)
                absolutePosition.set({
                    x: '50vw',
                    y: '50vh'
                })

                floatAnimIntervalParser(0, 0);

                floatInterval = setInterval(() => {
                    floatAnimIntervalParser(0, 0);
                }, 500);
                break;
            case "btnMode":
                btnModeClass.set(true)
                absolutePosition.set({
                    x: '50vw',
                    y: 'calc(100vh - 150px)'
                })
                break;
        }
    }

</script>

<script>
    export let buttonsState = [false, false, false, false]

    let cubes = [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 0 },
    ];

    
    async function onCubeClick(n) {
        if (!$loggedState) return

        controlsBtn.run($currentScreen, n)

        // let directionRef = database.ref(`users/${$uid}/direction`);

        // let directions = await directionRef.get()
        // directions = directions.val()||[0,0,0,0]
        // directions[n] = directions[n] == 1 ? 0 : 1

        // directionRef.set(directions);
    }
</script>

<div id="controlsContainer" class:btnMode={$btnModeClass} style="
    left: {$absolutePosition.x};
    top: {$absolutePosition.y};
    --scale: {$cubeProperties.scale};
    " >
    <div class="outerBtn1" class:active={buttonsState[0]} on:click={() => onCubeClick(0)} >
        <div
            class="btn1"
            style="--x: {AnimVal2cubes($animVal, $animVal2)[0].x}; --y: {AnimVal2cubes($animVal, $animVal2)[0].y}" >
            <div class="scene scene--box">
                <div class="box box--rotate">
                    <div class="box__face box__face--front" />
                    <div class="box__face box__face--back" />
                    <div class="box__face box__face--right" />
                    <div class="box__face box__face--left" />
                    <div class="box__face box__face--top" />
                    <div class="box__face box__face--bottom" />
                </div>
            </div>
        </div>
    </div>

    <div class="outerBtn2" class:active={buttonsState[1]} on:click={() => onCubeClick(1)} >
        <div
            class="btn2"
            style="--x: {AnimVal2cubes($animVal, $animVal2)[1].x}; --y: {AnimVal2cubes($animVal, $animVal2)[1].y}" >
            <div class="scene scene--box">
                <div class="box box--rotate">
                    <div class="box__face box__face--front" />
                    <div class="box__face box__face--back" />
                    <div class="box__face box__face--right" />
                    <div class="box__face box__face--left" />
                    <div class="box__face box__face--top" />
                    <div class="box__face box__face--bottom" />
                </div>
            </div>
        </div>
    </div>

    <div class="outerBtn3" class:active={buttonsState[2]} on:click={() => onCubeClick(2)} >
        <div
            class="btn3"
            style="--x: {AnimVal2cubes($animVal, $animVal2)[2].x}; --y: {AnimVal2cubes($animVal, $animVal2)[2].y}" >
            <div class="scene scene--box">
                <div class="box box--rotate">
                    <div class="box__face box__face--front" />
                    <div class="box__face box__face--back" />
                    <div class="box__face box__face--right" />
                    <div class="box__face box__face--left" />
                    <div class="box__face box__face--top" />
                    <div class="box__face box__face--bottom" />
                </div>
            </div>
        </div>
    </div>

    <div class="outerBtn4" class:active={buttonsState[3]} on:click={() => onCubeClick(3)} >
        <div
            class="btn4"
            style="--x: {AnimVal2cubes($animVal, $animVal2)[3].x}; --y: {AnimVal2cubes($animVal, $animVal2)[3].y}" >
            <div class="scene scene--box">
                <div class="box box--rotate">
                    <div class="box__face box__face--front" />
                    <div class="box__face box__face--back" />
                    <div class="box__face box__face--right" />
                    <div class="box__face box__face--left" />
                    <div class="box__face box__face--top" />
                    <div class="box__face box__face--bottom" />
                </div>
            </div>
        </div>
    </div>
</div>
