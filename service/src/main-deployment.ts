import * as program from "commander";
import {createEdgeDeploymentByEnvironment, listDeployments, triggerDeloyment, createEdgeDeploymentByDevice, clearDeployments, removeDeployment} from './deployment'

program
    .command('list').alias('ls')
    .option('-c, --conditions', 'show target conditions')
    .action((cmd)=>{
        listDeployments().then((result)=>{
            if('conditions' in cmd){
                console.log(result);
            }
            else{
                console.log(Object.keys(result));
            }
        })
        
    })

program
    .command('add <variation>')
    .option('-e, --environment <value>', 'set the environment tag')
    .option('-d, --device <id>', 'add specific deployment for device <id>')
    .action((variation, cmd)=>{
        if('environment' in cmd){
            createEdgeDeploymentByEnvironment(variation, cmd.environment)
        }
        if('device' in cmd){
            createEdgeDeploymentByDevice(variation, cmd.device)
            .then((deploymentId)=>{
                console.log(`${deploymentId} created for ${cmd.device}`)
            })
            .catch((err)=>{
                console.log("Create device-specific deployment wrong: " + err);
            })
            
        }
    })

program
    .command('trigger <id>')
    .action((id)=>{
        triggerDeloyment(id).then((id)=>{
            console.log(`${id} is updated and is waiting for redeployment on relevant devices`)
        })
    })

program
    .command('remove <id>')
    .action((id)=>{
        if(id == 'all'){
            clearDeployments().then((result)=>{
                console.log(`Removed deployments: ${result}`);
            })
        }
        else{
            removeDeployment(id).then((result)=>{
                console.log(`Remove deployment: ${result}`);
            })
        }
        
    })


program.parse(process.argv);

//program.parse(process.argv);