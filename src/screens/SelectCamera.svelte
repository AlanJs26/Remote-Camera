<script>
  import { fade } from "svelte/transition";
  import { currentScreen, uid } from "../stores/app.js";
  import { auth, database } from "../firebase";
  import { subscribeToBackBtn } from "../components/Header.svelte";
  import Loading from '../screens/Loading.svelte'

  subscribeToBackBtn("selectCamera", () => {
    currentScreen.set("cameraOwner");
  });


  let inputValue = "";
  let isLoading = true;
  let loadingTimeout = setTimeout(() => {isLoading = false}, 1000)

  function* notFirstGen() {
    console.log("first - blocked");
    yield false;
    let dotString = "";
    for (let i = 0; i < 3; i++) {
      console.log("second - alowed" + dotString);
      yield true;
      dotString.concat(".");
    }
    console.log("last");
    yield;
  }

  connectFromCode("");
  async function connectFromCode(code) {
    const lastCameraRef = database.ref("/users/" + $uid + "/lastCamera");
    let lastCamera = await lastCameraRef.get();
    let reconnectValidUntilRef = database.ref(
      "/users/" + lastCamera.val() + "/reconnectValidUntil"
    );
    if (code.length == 4) {
      const codeRef = database.ref("/cameras/codes/" + code);
      const snapshot = await codeRef.get();

      if (!snapshot.exists()) {
        console.log("code is not valid");
        return;
      }

      console.log($uid);
      var cameraUid = snapshot.val();

      const connectedWithRef = database.ref(
        "/users/" + cameraUid + "/connectedWith"
      );
      connectedWithRef.set($uid);
    } else {
      let reconnectValidUntil = await reconnectValidUntilRef.get();
      reconnectValidUntil = reconnectValidUntil.val();

      if (lastCamera.exists && reconnectValidUntil*1000 > Date.now()) {
        console.log("using last camera uid as default");
        cameraUid = lastCamera.val();
      } else {
        return;
      }
    }

    const notFirst = notFirstGen();
    lastCameraRef.set(cameraUid);

    reconnectValidUntilRef = database.ref(
      "/users/" + cameraUid + "/reconnectValidUntil"
    );
    reconnectValidUntilRef.on("value", (snapshot) => {
      const data = (snapshot.val()+10800) * 1000;

      console.log("reconnectValidUntil - " + data);

      if (notFirst.next().value == false) return;

      if (data > Date.now()) {
        clearTimeout(loadingTimeout)
        currentScreen.set("main");

        reconnectValidUntilRef.off();
      }
    });
    const testAliveRef = database.ref("/users/" + cameraUid + "/testAlive");
    let randnum = Math.floor(Math.random() * 1000);
    console.log(randnum);
    setTimeout(() => testAliveRef.set(randnum), 500);
  }
</script>

<div class="flexColumn" class:isLoading style="position: absolute; z-index: 4">
{#if isLoading }
  <div style="height: 80vh; display: flex; justify-content: center">
    <Loading />
  </div>
{:else}
  <h3>Código da câmera</h3>
  <div id="cameraOwner" transition:fade class="container">
    <input
      type="text"
      class="transparentInput"
      placeholder="Digite Aqui"
      bind:value={inputValue}
      on:keypress={(e) => {
        if (e.key == "Enter") connectFromCode(inputValue);
      }}
    />

    <button class="transparentBtn" on:click={() => connectFromCode(inputValue)}>
      <p>Conectar</p>
    </button>
  </div>
{/if}
</div>


<style>
  .container {
    height: 60px;
  }

  input {
    margin-right: 5px;
    width: 200% !important;
  }

  button.transparentBtn:not(:disabled):active{
      background-color: rgba(255, 255, 255, 0.30); 
  }

  button.transparentBtn {
    border: none;
    outline: none;
    margin: 5px;
  }

  .transparentBtn {
    margin: 0 !important;
    margin-left: 5px !important;
  }

  .flexColumn {
    margin-top: 5em;
    max-width: 500px;
    max-height: 100px;
    margin: 15px;
  }

  .flexColumn.isLoading {
    max-width: unset;
    max-height: unset;
  }
</style>
