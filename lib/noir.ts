import {NativeModules, Platform} from 'react-native';
import {Circuit, Parameter, ParameterType} from '../types';
const {NoirModule} = NativeModules;

export async function prepareSrs() {
  // Only needed for Android
  if (Platform.OS === 'android') {
    await NoirModule.prepareSrs();
  }
}

export async function setupCircuit(
  circuit: Circuit,
  recursive: boolean = false,
) {
  const {circuitId} = await NoirModule.setupCircuit(
    JSON.stringify(circuit),
    recursive,
  );
  return circuitId as string;
}

function computeInputArraySize(type: ParameterType) {
  let count = 0;
  if (type.type && type.type.kind === 'array') {
    count += (type.length || 0) * computeInputArraySize(type.type);
  } else {
    count += type.length || 0;
  }
  return count;
}

function computePublicInputsSize(params: Parameter[]) {
  let fieldCount = 0;
  for (let param of params) {
    if (param.visibility === 'private') {
      continue;
    }
    if (param.type.kind === 'array') {
      fieldCount += computeInputArraySize(param.type);
    } else if (param.type.kind === 'string') {
      fieldCount += param.type.length || 0;
    } else if (param.type.kind === 'struct') {
      fieldCount += computePublicInputsSize(param.type.fields!);
    } else {
      fieldCount += 1;
    }
  }
  return fieldCount;
}

function getLastIndexOfPublicInputs(circuit: Circuit) {
  // Each field is encoded as a hexadecimal string of 64 characters (i.e. 32 bytes)
  return 64 * 3 + 8 + computePublicInputsSize(circuit.abi.parameters) * 64;
}

export function extractRawPublicInputs(
  circuit: Circuit,
  proofWithPublicInputs: string,
) {
  const lastIndex = getLastIndexOfPublicInputs(circuit);
  return proofWithPublicInputs.slice(64 * 3 + 8, lastIndex);
}

export function extractProof(circuit: Circuit, proofWithPublicInputs: string) {
  const lastIndex = getLastIndexOfPublicInputs(circuit);
  return (
    proofWithPublicInputs.slice(8, 8 + 64 * 3) +
    proofWithPublicInputs.slice(lastIndex)
  );
}

export async function generateProof(
  inputs: {[key: string]: any},
  circuitId: string,
  proofType: 'honk' = 'honk',
  recursive: boolean = false,
) {
  const {proof, vkey} = await NoirModule.prove(
    inputs,
    circuitId,
    proofType,
    recursive,
  );

  return {
    proofWithPublicInputs: proof,
    vkey,
  };
}

export async function verifyProof(
  proofWithPublicInputs: string,
  vkey: string,
  circuitId: string,
  proofType: 'honk' = 'honk',
) {
  const {verified} = await NoirModule.verify(
    proofWithPublicInputs,
    vkey,
    circuitId,
    proofType,
  );
  return verified;
}

export async function clearCircuit(circuitId: string) {
  await NoirModule.clearCircuit(circuitId);
}

export async function clearAllCircuits() {
  await NoirModule.clearAllCircuits();
}