// import firebase from 'firebase';
// const firebase = require('firebase')
// import 'firebase/firestore';
// const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('wrtc');
// import RTCPeerConnection from 'wrtc';

import firebase from 'firebase/app';// rollup bundle issue with ESM import
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyAcT5oGP6ZFtJ5sHXsqxVa6DwgwxBzVexw",
    authDomain: "remotecamera-6f583.firebaseapp.com",
    databaseURL: "https://remotecamera-6f583-default-rtdb.firebaseio.com",
    projectId: "remotecamera-6f583",
    storageBucket: "remotecamera-6f583.appspot.com",
    messagingSenderId: "828538172310",
    appId: "1:828538172310:web:827aa1ba489b3bb53aa3b7",
    measurementId: "G-247RTVTFW6"
};

firebase.initializeApp(firebaseConfig);

export const firestore = firebase.firestore();
export const auth = firebase.auth();
export const database = firebase.database();

export const googleProvider = new firebase.auth.GoogleAuthProvider();