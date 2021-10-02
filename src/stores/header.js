import { writable } from 'svelte/store';

export const backCallbacks = writable([]);

export class ObservableButton{
    constructor(){
        this.keyFunctions = {}
    }

    assignFunction(key, callback){

        this.keyFunctions[key] = callback
    }

    run(key, properties){
        
        if(this.keyFunctions.hasOwnProperty(key)){
            if(properties != undefined){
                this.keyFunctions[key](properties)
            }else{
                this.keyFunctions[key]()
            }
            return
        }
        console.warn(`any callback associated with '${key}'`)
    }
    
}

export const configBtn = new ObservableButton()