<script>
  import { fade } from "svelte/transition";
  import { currentScreen } from "../stores/app.js";
  import { auth } from "../firebase";
  import { subscribeToBackBtn } from "../components/Header.svelte";
  import Loading  from "../screens/Loading.svelte";
  import { username } from "../stores/main.js";

  subscribeToBackBtn("cameraOwner", () => {
    auth.signOut();
    console.log("signing out");
  });

  let videoInputs = [];
  let warningText = "";
  let refreshInterval;
  let loading = false;

  const detectAvailableCameras = () => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      videoInputs = [];
      for (let device of devices) {
        if (device.kind == "videoinput") videoInputs.push(device);
      }
      // console.log(videoInputs)
      if (videoInputs.length == 0) {
        warningText = "Nenhuma camêra detectada";
        // console.log(warningText)
      }
    });

    if (!warningText && window.location.search) {
      const urlParams = new URLSearchParams(window.location.search);
      const usernameToConnect = urlParams.get("q");

      if (usernameToConnect) {
        clearInterval(refreshInterval);
        loading=true;
        setTimeout(() => {
          username.set(usernameToConnect);
          currentScreen.set("main");
        }, 1000);
      }
    }
  };

  refreshInterval = setInterval(detectAvailableCameras, 2000);
  detectAvailableCameras();

  $: if (videoInputs.length > 0) {
    warningText = "";
  }
</script>

{#if loading}
  <div class="loading">
    <Loading/>
  </div>
{:else}
  <div class="flexColumn" style="position: absolute; z-index: 4">
    <div id="cameraOwner" transition:fade class="container">
      <button
        class="transparentBtn"
        class:disabledBtn={warningText}
        on:click={() => {
          if (!warningText) currentScreen.set("selectCamera");
        }}
      >
        <p>Utilizar a própria câmera</p>
      </button>

      <button
        class="transparentBtn"
        on:click={() => {
          clearInterval(refreshInterval);
          currentScreen.set("selectCameraToConnect");
        }}
      >
        <p>Conectar a uma câmera</p>
      </button>
    </div>

    {#if warningText}
      <p class="warningText" transition:fade>
        {warningText}
      </p>
    {/if}
  </div>
{/if}

<style>
  .loading {
    align-items: center;
    justify-content: center;
    height: 30vh;
    display: flex;
  }

  .disabledBtn {
    background: #dadada38;
  }
  .disabledBtn,
  .disabledBtn > *,
  .disabledBtn:hover {
    color: #a7a7a7;
    cursor: default;
    box-shadow: none;
  }

  button.transparentBtn:not(:disabled):active {
    background-color: rgba(255, 255, 255, 0.3);
  }

  button.transparentBtn {
    border: none;
    outline: none;
    margin: 5px;
    height: clamp(50px, 15vh, 150px);
    width: clamp(100px, 20vw, 200px);
  }

  .warningText {
    color: #ff2f2f;
    font-size: 1.5em;
    margin: 10px 0 0 0;
    background: #76001c87;
    border: solid 2px #ff2f2f;
    padding: 5px;
  }

  .flexColumn {
    margin-top: 5em;
    max-width: 500px;
    max-height: 100px;
    margin: 15px;
  }
</style>
