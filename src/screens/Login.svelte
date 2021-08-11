<script>
  import { fade } from 'svelte/transition';

  import {setCubesState} from "../components/Cubes.svelte";
  import {currentScreen} from "../stores/app.js";
  import { auth, googleProvider } from '../firebase';

  let username = ''
  // let passwordText = ''

  let wrongCredentials = false


  function loginUser(e){
    if(e){
      console.log(e instanceof KeyboardEvent)
      console.log(e)
      if(e.keyCode != 13)
        return
    }

    auth.signInAnonymously()
    .then(() => {
      const user = auth.currentUser;

      user.updateProfile({
        displayName: username
      }).catch((error) => {
        console.error(error)
      });  
    })
    .catch((error) => {
      var errorCode = error.code;
      var errorMessage = error.message;
      console.error(errorCode+'\n'+errorMessage)
      wrongCredentials = true
    });
  }

</script>

<div id="login-form" transition:fade style="position: absolute;" >

  {#if wrongCredentials}
    <p class="warning" transition:fade={{duration: 200}} >credenciais incorretas</p>
  {/if}

  <div class="flexColumn">
    

    <div class="inputWrapper" class:wrongCredentials >
        <input type="text" placeholder="Nome de Usuário" bind:value={username} class="transparentInput" on:keypress={loginUser}>
        <!-- <input type="text" placeholder="Senha" bind:value={passwordText} class="transparentInput" > -->
    </div>

    <div class="transparentBtn" on:click={loginUser} >
      <p>Login</p>
    </div>
    <!-- <p class='createAccountText' >não tem uma conta? <span on:click={createUser} >Crie uma nova</span></p> -->
  </div>


</div>

<style>

div#login-form{
    z-index: 5;
    padding: 50px 20px;
    background: #561b65d1;
    box-shadow: 0px 0px 10px #5a0079b8;
    max-width: 400px;
    width: 80vw;
}

/* .flexColumn {
  max-width: 400px;
  width: 100%;
} */

.transparentBtn {
  max-width: 200px;
}

.transparentInput {
  width: 100%;
  height: 30px;
  opacity: 0.7;
  border: 1.1px solid rgba(255, 255, 255, 0.3);
}

.inputWrapper {
  width: 100%;
  margin-bottom: 40px;
}

/* .createAccountText {
  color:rgba(255, 255, 255, 0.5);
  font-size: 0.7em;
  margin-top: 5px;
} */

/* span {
  //text-decoration: underline;
  color: white;
  cursor: pointer;
  font-weight: bold;
} */

.warning {
  position: absolute;
  margin: 0;
  transform: translateY(-37px);
  color: #ff4700;
  animation: shake 0.82s cubic-bezier(.36,.07,.19,.97) both;
}

input {
  transition: 0.2s
}

.wrongCredentials input {
  border-color: rgb(255, 44, 0)!important;
}

.wrongCredentials input::placeholder {
  color: rgb(255, 44, 0)!important;
}

/* div#login-form div.transparentBtn::before{
    content: '';
    background-image: url("https://www.seekpng.com/png/full/788-7887426_google-g-png-google-logo-white-png.png");
    background-position: center;
    background-size: 90%;
    background-repeat: no-repeat;
    width: 30px;
    height: 30px;
    margin: 10px;
} */

@keyframes shake {
  10%, 90% {
    transform: translate(-1px, -37px);
  }
  
  20%, 80% {
    transform: translate(2px, -37px);
  }

  30%, 50%, 70% {
    transform: translate(-4px, -37px);
  }

  40%, 60% {
    transform: translate(4px, -37px);
  }
}

</style>