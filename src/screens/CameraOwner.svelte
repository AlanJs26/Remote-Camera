<script>
  import { fade } from 'svelte/transition';
  import {currentScreen} from '../stores/app.js'
  import { auth } from '../firebase';
  import {subscribeToBackBtn} from "../components/Header.svelte";

  subscribeToBackBtn('cameraOwner', () => {
    auth.signOut()
    console.log('signing out')
  })

  let videoInputs = []

  const intervalFunction = () => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      videoInputs = []
      for(let device of devices){
        if(device.kind == 'videoinput')
          videoInputs.push(device)
      }
      // console.log(videoInputs)
      if(videoInputs.length==0){
        warningText = 'Nenhuma camêra detectada'
        // console.log(warningText)
      }
    })
  }

  setInterval(intervalFunction, 2000);
  intervalFunction()

  $: if(videoInputs.length>0){
    warningText = ''
  }

let warningText = ''

</script>

<div class="flexColumn" style="position: absolute" >
  <div id="cameraOwner" transition:fade class="container">
    <div class="transparentBtn" class:disabledBtn={warningText} on:click={() => {if(!warningText) currentScreen.set('main')}} >
      <p>Utilizar a própria câmera</p>
    </div>
  
    <div class="transparentBtn" on:click={() => currentScreen.set('selectCameraToConnect')} >
      <p>Conectar a uma câmera</p>
    </div>
  </div>

  {#if warningText}
    <p class="warningText" transition:fade >
      {warningText}
    </p>
  {/if}
</div>



<style>

.disabledBtn{
  background: #dadada38;
}
  .disabledBtn, .disabledBtn > *, .disabledBtn:hover{
    color: #a7a7a7;
    cursor: default;
    box-shadow: none;
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
  }
</style>