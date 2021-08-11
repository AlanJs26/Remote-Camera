import { writable } from 'svelte/store';

export const currentScreen = writable("login");
export const loggedState = writable(false);
export const uid = writable(null);
export const isPeerReady = writable(false);