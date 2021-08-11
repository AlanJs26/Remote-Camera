<script>
  import { fade } from 'svelte/transition';
  import { auth } from '../firebase';

  import VideoStream from '../screens/VideoStream.svelte'
  import {setCubesState} from "./Cubes.svelte";
  import {currentScreen} from '../stores/app.js'
  import {backCallbacks, configBtn} from '../stores/header.js'

  let configDisabled = true 
  let backEnabled = false 
  let videoEnabled = false
  let screensWhereDisableConfig = ['login', 'cameraOwner', 'selectCameraToConnect', 'loading']
  let screensWhereEnableBack = ['cameraOwner', 'selectCameraToConnect']
  
  // $: screensWhereEnableBack = $backCallbacks.map(item => item[0])
  $: videoEnabled = $currentScreen == 'main' ? true : false

  let body = document.body

  $: if($currentScreen == 'main'){
        body.classList.add('videoEnabled')
      }else{
        body.classList.remove('videoEnabled')
      }

  currentScreen.subscribe(screen => {
    if(screensWhereDisableConfig.indexOf(screen) != -1){
      configDisabled = true
    }else{
      configDisabled = false
    }

    if(screensWhereEnableBack.indexOf(screen) != -1){
      backEnabled = true
    }else{
      backEnabled = false
    }
  })

  function backOnClick(){
    for(let item of $backCallbacks){
      if(item[0] == $currentScreen){
        item[1]()
      }
    }
  }

  let isConfigActive = false
  let configTimeout = null

</script>

<script context="module">
  // import {backCallbacks} from '../stores/header.js'

  export function subscribeToBackBtn(screen, callback){
    backCallbacks.update((paramBackCallbacks) => {
      let found = false
      paramBackCallbacks.map((item) => {
        if(item[0] == screen){
          found = true
          return [screen, callback]
        }else{
          return item
        }
      })
  
      if(found == true) return paramBackCallbacks
  
      paramBackCallbacks.push([screen, callback])
      return paramBackCallbacks
    })
  }
</script>

<div class="topContent" transition:fade >
  <div class="configContainer" class:disabled={configDisabled} class:active={isConfigActive} on:click={() => isConfigActive = true} on:mouseleave={() => {configTimeout = setTimeout(() => {isConfigActive=false}, 300)}} on:mouseenter={() => clearTimeout(configTimeout)} >
    <div id="configBtn"><i class="fas fa-cog fa-2x" /></div>
    <ul id="configItems">
      <li>Perfil</li>
      <li id="cameraConfigBtn" on:click={configBtn.run($currentScreen)} >Configurações</li>
      <li id="logoutBtn" on:click={() => auth.signOut()} >Log out</li>
    </ul>
  </div>

  <div class="backContainer" class:disabled={!backEnabled || !configDisabled}>
    <div class="backBtn" on:click={backOnClick} ><i class="fas fa-arrow-left fa-2x"></i></div>
  </div>

  <div class="header">
    {#if videoEnabled}
      <div transition:fade ><div>
        <VideoStream/>  
      </div></div>
    {:else}
      <div transition:fade ><div>
        <h1 class="title" >Remote Camera</h1>
      </div></div>
    {/if}
  </div>
</div>


<style>
.header > div {
  flex: 1;
  position: absolute;
  width: 45vw;
}

.header > div > div {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}
.backContainer {
    margin: 10px;
    position: absolute;
    color:rgba(255, 255, 255, 0.7);
    transition: opacity 1s;
    width: 50px;
    top: 0px;
    left: 0px;
    cursor: pointer;
    
}
</style>
