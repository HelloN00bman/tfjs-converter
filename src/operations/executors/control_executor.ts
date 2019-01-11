/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tfc from '@tensorflow/tfjs-core';
import {scalar} from '@tensorflow/tfjs-core';
import {NamedTensorsMap} from '../../data/types';
import {ExecutionContext} from '../../executor/execution_context';
import {FIFOQueue} from '../../executor/fifo_queue';
import {TensorArray} from '../../executor/tensor_array';
import {Node} from '../types';
import {getParamValue, getTensor} from './utils';

export async function executeOp(
    node: Node, tensorMap: NamedTensorsMap,
    context: ExecutionContext): Promise<tfc.Tensor[]> {
  switch (node.op) {
    case 'loopCond':
      return [
        (getParamValue('pred', node, tensorMap, context) as tfc.Tensor).clone()
      ];
    case 'switch': {
      const pred =
          getParamValue('pred', node, tensorMap, context) as tfc.Tensor;
      const data =
          getParamValue('data', node, tensorMap, context) as tfc.Tensor;
      // Outputs nodes :0 => false, :1 => true
      return (await pred.data())[0] ? [undefined, data.clone()] :
                                      [data.clone(), undefined];
    }
    case 'merge':
      const inputName = node.inputNames.find(
          name => getTensor(name, tensorMap, context) !== undefined);
      return inputName ? [getTensor(inputName, tensorMap, context).clone()] :
                         undefined;

    case 'enter':
      const frameId =
          getParamValue('frameName', node, tensorMap, context) as string;
      const data =
          getParamValue('tensor', node, tensorMap, context) as tfc.Tensor;
      context.enterFrame(frameId);
      return [data.clone()];

    case 'exit':
      const tensor =
          getParamValue('tensor', node, tensorMap, context) as tfc.Tensor;
      context.exitFrame();
      return [tensor.clone()];

    case 'nextIteration':
      const input =
          getParamValue('tensor', node, tensorMap, context) as tfc.Tensor;
      context.nextIteration();
      return [input.clone()];

    case 'tensorArray':
      const size = getParamValue('size', node, tensorMap, context) as number;
      const dtype =
          getParamValue('dtype', node, tensorMap, context) as tfc.DataType;
      const elementShape =
          getParamValue('elementShape', node, tensorMap, context) as number[];
      const dynamicSize =
          getParamValue('dynamicSize', node, tensorMap, context) as boolean;
      const clearAfterRead =
          getParamValue('clearAfterRead', node, tensorMap, context) as boolean;
      const identicalElementShapes =
          getParamValue('identicalElementShapes', node, tensorMap, context) as
          boolean;
      const name = getParamValue('name', node, tensorMap, context) as string;
      const tensorArray = new TensorArray(
          name, dtype, size, elementShape, identicalElementShapes, dynamicSize,
          clearAfterRead);
      context.addTensorArray(tensorArray);
      return [scalar(tensorArray.id), scalar(1.0)];

    case 'tensorArrayWrite':
      const id =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const index = getParamValue('index', node, tensorMap, context) as number;
      const writeTensor =
          getParamValue('tensor', node, tensorMap, context) as tfc.Tensor;
      const writeTensorArray = context.getTensorArray(id);
      writeTensorArray.write(index, writeTensor);
      return [scalar(1.0)];

    case 'tensorArrayRead':
      const readId =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const readIndex =
          getParamValue('index', node, tensorMap, context) as number;
      const readTensorArray = context.getTensorArray(readId);
      return [readTensorArray.read(readIndex)];

    case 'tensorArrayGather':
      const gatherId =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const gatherIndices =
          getParamValue('indices', node, tensorMap, context) as number[];
      const gatherDtype =
          getParamValue('dtype', node, tensorMap, context) as tfc.DataType;
      const gatherTensorArray = context.getTensorArray(gatherId);
      return [gatherTensorArray.gather(gatherIndices, gatherDtype)];

    case 'tensorArrayScatter':
      const scatterId =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const scatterIndices =
          getParamValue('indices', node, tensorMap, context) as number[];
      const scatterTensor =
          getParamValue('tensor', node, tensorMap, context) as tfc.Tensor;
      const scatterTensorArray = context.getTensorArray(scatterId);
      scatterTensorArray.scatter(scatterIndices, scatterTensor);
      return [scalar(1.0)];

    case 'tensorArrayConcat':
      const concatId =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const concatTensorArray = context.getTensorArray(concatId);
      const concatDtype =
          getParamValue('dtype', node, tensorMap, context) as tfc.DataType;
      return [concatTensorArray.concat(concatDtype)];

    case 'tensorArraySplit':
      const splitId =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const splitTensor =
          getParamValue('tensor', node, tensorMap, context) as tfc.Tensor;
      const lengths =
          getParamValue('lengths', node, tensorMap, context) as number[];
      const splitTensorArray = context.getTensorArray(splitId);
      splitTensorArray.split(lengths, splitTensor);
      return [scalar(1.0)];

    case 'tensorArraySize':
      const sizeId =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const sizeTensorArray = context.getTensorArray(sizeId);
      return [scalar(sizeTensorArray.size(), 'int32')];

    case 'tensorArrayClose':
      const closeId =
          getParamValue('tensorArrayId', node, tensorMap, context) as number;
      const closeTensorArray = context.getTensorArray(closeId);
      closeTensorArray.clearAndClose();
      return [];

    case 'fifoQueue':
      const dtypes =
          getParamValue('dtypes', node, tensorMap, context) as tfc.DataType[];
      const shapes =
          getParamValue('shapes', node, tensorMap, context) as number[][];
      const capacity =
          getParamValue('capacity', node, tensorMap, context) as number;
      const container =
          getParamValue('container', node, tensorMap, context) as string;
      const queueName =
          getParamValue('name', node, tensorMap, context) as string;
      const fifoQueue =
          new FIFOQueue(dtypes, shapes, capacity, queueName, container);
      context.addFIFOQueue(fifoQueue);
      return [scalar(fifoQueue.id), scalar(1.0)];

    case 'queueDequeueUpTo':
      const queueDequeueUpToId =
          getParamValue('fifoQueueId', node, tensorMap, context) as number;
      const num = getParamValue('num', node, tensorMap, context) as number;
      const dequeueUpToDtypes =
          getParamValue('dtypes', node, tensorMap, context) as tfc.DataType[];
      const dequeueUpToQueue = context.getFIFOQueue(queueDequeueUpToId);
      return dequeueUpToQueue.dequeueUpTo(num, dequeueUpToDtypes);

    default:
      throw TypeError(`Node type ${node.op} is not implemented`);
  }
}

export const CATEGORY = 'control';
