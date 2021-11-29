<script>
    import { fade } from "svelte/transition";

    import { subscribeToBackBtn } from "../components/Header.svelte";
    import { currentScreen } from "../stores/app.js";
    import { username } from "../stores/main.js";

    let inputValue = "";

    subscribeToBackBtn("selectCameraToConnect", () => {
        currentScreen.set("cameraOwner");

        console.log("changing to cameraOwner");
    });

    function btnOnClick() {
        username.set(inputValue);
        currentScreen.set("main");
    }
</script>

<div style="position: absolute;" class="container" transition:fade>
    <h3>A quem você deseja se conectar?</h3>
    <input
        type="text"
        class="transparentInput"
        placeholder="Digite Aqui"
        bind:value={inputValue}
    />
    <div class="transparentBtn" on:click={btnOnClick}>
        <p>Próximo</p>
    </div>
</div>

<style>
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 5;
    }
    .transparentInput {
        height: 30px;
        border: solid #fff3 2px;
        /* padding-bottom: 8px */
    }
    h3 {
        margin: 0 0 20px 0;
    }
</style>
