<script>
  import { fade } from "svelte/transition";
  import { currentScreen, uid } from "../stores/app.js";
  import { auth, database } from "../firebase";
  import { subscribeToBackBtn } from "../components/Header.svelte";

  subscribeToBackBtn("selectCamera", () => {
    currentScreen.set("cameraOwner");
  });

  let inputValue = "";

  connectFromCode("");
  async function connectFromCode(code) {
    const lastCameraRef = database.ref("/users/" + $uid + "/lastCamera");
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
      const lastCamera = await lastCameraRef.get();
      console.log(lastCamera.val());

      if (lastCamera.exists) {
        cameraUid = lastCamera.val();
      } else {
        return;
      }
    }

    lastCameraRef.set(cameraUid);

    const readyRef = database.ref("/users/" + cameraUid + "/ready");
    readyRef.on("value", (snapshot) => {
      const data = snapshot.val();
      if (snapshot.exists() && data) {
        console.log("READY!!!!!");
        currentScreen.set("main");

        readyRef.off();
      }
    });
  }
</script>

<div class="flexColumn" style="position: absolute; z-index: 4">
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

    <div class="transparentBtn" on:click={() => connectFromCode(inputValue)}>
      <p>Conectar</p>
    </div>
  </div>
</div>

<style>
  .container {
    height: 60px;
  }

  input {
    margin-right: 5px;
    width: 200% !important;
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
</style>
