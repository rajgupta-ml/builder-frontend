import { NodeTypes } from '@xyflow/react';
import TextInputNode from './TextInputNode';
import MediaNode from './MediaNode';
import ChoiceNode from './ChoiceNode';
import { StartNode, EndNode } from './StructuralNodes';
import RatingNode from './RatingNode';
import RankingNode from './RankingNode';
import SliderNode from './SliderNode';
import BranchNode from './BranchNode';
import ConsentNode from './ConsentNode';
import MultiInputNode from './MultiInputNode';
import ZipCodeInputNode from './ZipCodeInputNode';
import MatrixChoiceNode from './MatrixChoiceNode';
import CascadingChoiceNode from './CascadingChoiceNode';
import { NODE_DEFINITIONS } from './definitions';

// Map of Component Implementations
const componentMap: Record<string, React.ComponentType<any>> = {
    textInput: TextInputNode,
    numberInput: TextInputNode,
    emailInput: TextInputNode,
    dateInput: TextInputNode,

    singleChoice: ChoiceNode,
    multipleChoice: ChoiceNode,
    dropdown: ChoiceNode,
    rating: RatingNode,
    slider: SliderNode,
    ranking: RankingNode,
    consent: ConsentNode,
    multiInput: MultiInputNode,

    image: MediaNode,
    video: MediaNode,
    audio: MediaNode,

    start: StartNode,
    end: EndNode,
    branch: BranchNode,

    zipCodeInput: ZipCodeInputNode,
    matrixChoice: MatrixChoiceNode,
    cascadingChoice: CascadingChoiceNode,
};

export const nodeTypes: NodeTypes = componentMap;

import DeleteableEdge from '../edges/DeleteableEdge';
export const edgeTypes = {
    default: DeleteableEdge,
};

export * from './definitions';

