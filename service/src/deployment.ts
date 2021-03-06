import { Registry, Device, Twin } from 'azure-iothub';

import * as fs from 'fs';

//var iothub = require('azure-iothub');
import * as yaml from 'node-yaml';
import { results } from 'azure-iot-common';

var credential = yaml.readSync('../../azureiot.credential');
var connectionString = credential.iothub.connection;
let registry = Registry.fromConnectionString(connectionString);

var pool = yaml.readSync('../pool.yaml')
//console.log(pool);

var resolvePool = function(input_pool){
    var result = {}
    var variants = input_pool.variants;
    for (var varname in variants){
        var variant = variants[varname];
        var valuestr = JSON.stringify(input_pool.templates[variant.template])
        for (var param in variant.parameter){
            valuestr = valuestr.replace('{{'+param+'}}', variant.parameter[param])
        }
        JSON.parse(valuestr)
        result[varname] = JSON.parse(valuestr)
    }
    return result;
}

var candidates = resolvePool(pool);

export async function removeDeployment(deploymentId: string){
    return new Promise<string>((resolve) => { 
        registry.removeConfiguration(deploymentId, function(err) {
            if(err){
                //TODO: Assuming the only reason for failure is "no deployment found"
                console.log(deploymentId + " not found. No need to remove");
                resolve(deploymentId); 
            }
            else{
                resolve(deploymentId);
            }
        });
    });
}

async function createEdgeDeployment (deploymentId: string, modules: object, condition: string, priority:number = 1): Promise<string> {
    return new Promise<string>((resolve, reject) => { 
        let baseDeployment = JSON.parse(fs.readFileSync('./base_deployment.json', 'utf8'));
        baseDeployment.id = deploymentId;
        baseDeployment.content.modulesContent.$edgeAgent['properties.desired'].modules=modules;
        baseDeployment.targetCondition = condition; 
        baseDeployment.priority = priority;
        
        removeDeployment(deploymentId).then((id)=>{
            registry.addConfiguration(baseDeployment, function(err) {
                if (err) {
                    console.log('add configuration failed: ' + err);
                    reject(err);
                } else {
                    console.log('add configuration succeeded: ' + deploymentId);
                    resolve(deploymentId);
                }
            }); 
        });
    });
}

export async function createEdgeDeploymentByEnvironment(varname: string, environment: string){
    return createEdgeDeployment(
        `env_${environment}`,
        candidates[varname],
        `tags.environment='${environment}'`
    );
}

async function removeEdgeDeploymentForDevice(deviceId: string): Promise<String>{
    let deployments = await listDeployments();
    let removed = [];
    for(let deployment of Object.keys(deployments)){
        if(deployment.startsWith(`device_${deviceId}_`)){
            removed.push(removeDeployment(deployment))
        }
    }
    let finallyRemoved = await Promise.all(removed);
    return Promise.resolve(finallyRemoved.pop());
}

export async function createEdgeDeploymentByDevice(varname: string, deviceId: string){
    let removed = await removeEdgeDeploymentForDevice(deviceId);
    if(removed){
        console.log(`Deployment ${removed} removed first`)
    }
    return createEdgeDeployment(
        `device_${deviceId}_${varname}`.toLowerCase(),
        candidates[varname],
        `deviceId='${deviceId}'`,
        10
    );
}

export async function listDeployments(): Promise<object>{
    let deployments = (await registry.getConfigurations()).responseBody;
    let result = {};
    for(let dpl of deployments){
        result[dpl.id] = dpl.targetCondition;
    }
    return Promise.resolve(result);
}

export async function triggerDeloyment(deploymentId: string): Promise<string>{
    let deployment = (await registry.getConfiguration(deploymentId)).responseBody;
    deployment.priority += 1;
    
    return Promise.resolve(<string>(await registry.updateConfiguration(deployment)).responseBody.id);

}

export async function clearDeployments(): Promise<string[]>{
    let deployments = await listDeployments();
    let result: Promise<string>[] = [];
    for(let id of Object.keys(deployments)){
        result.push(removeDeployment(id))
    }
    return Promise.all(result);
}



