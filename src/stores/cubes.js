import { writable } from 'svelte/store';
import {ObservableButton} from './header'

export const cubeSize = writable({
    scale: 1
});

export const controlsBtn = new ObservableButton()

export const buttonsState = writable([false, false, false, false]);
