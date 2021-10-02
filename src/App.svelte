<script>
  import "./css/stylesButton.css";
  import "./css/style.css";
  import {
    currentScreen,
    isPeerReady,
    loggedState,
    uid,
  } from "./stores/app.js";
  import { buttonsState, cubeSize as cubeProperties } from "./stores/cubes";
  import { auth } from "./firebase";

  import Header from "./components/Header.svelte";
  import Cubes, { setCubesState } from "./components/Cubes.svelte";

  import Login from "./screens/Login.svelte";
  import CameraOwner from "./screens/CameraOwner.svelte";
  import SelectCameraToConnect from "./screens/SelectCameraToConnect.svelte";
  import SelectCamera from "./screens/SelectCamera.svelte";
  import Loading from "./screens/Loading.svelte";

  setCubesState("floatOpening");

  const resize = () => {
    let w = window.outerWidth;

    cubeProperties.set({
      scale: w / 880,
    });
  };

  window.addEventListener("resize", resize);
  resize();

  isPeerReady.subscribe((isReady) => {
    if ($uid && isReady) {
      currentScreen.set("cameraOwner");
    }
  });

  auth.onAuthStateChanged((user) => {
    if (user) {
      loggedState.set(true);
      uid.set(user.uid);

      currentScreen.set("loading");
    } else {
      loggedState.set(false);
      uid.set(null);

      setCubesState("floatOpening");
      currentScreen.set("login");
    }
  });
</script>

<div class="shapes">
  <div class="circle" style="--size: 500px; --left: 5; --order: 5;" />
  <div class="circle" style="--size: 400px; --left: 2; --order: 4;" />
  <div class="circle" style="--size: 300px; --left: 3; --order: 3;" />
  <div style="--size: 200px; --left: 1; --order: 2;" />
  <div class="circle" style="--size: 100px; --left: 4; --order: 2.5;" />
  <div style="--size: 100px; --left: 4; --order: 2.5;" />
</div>

<Header />

<div class="midContent">
  {#if $currentScreen == "login"}
    <Login />
  {:else if $currentScreen == "cameraOwner"}
    <CameraOwner />
  {:else if $currentScreen == "selectCameraToConnect"}
    <SelectCameraToConnect />
  {:else if $currentScreen == "loading"}
    <Loading />
  {:else if $currentScreen == "selectCamera"}
    <SelectCamera />
  {/if}

  <Cubes buttonsState={$buttonsState} />
</div>
