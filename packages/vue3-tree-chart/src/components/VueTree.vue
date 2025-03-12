<template>
  <div class="tree-container" ref="container">
    <svg class="svg vue-tree" ref="svg" :style="initialTransformStyle"></svg>
    <div class="dom-container" ref="domContainer" :style="initialTransformStyle">
      <transition-group name="tree-node-item" tag="div">
        <div class="node-slot" v-for="(node, index) of nodeDataList" @click="onClickNode(index)" :key="node.data._key"
          :style="{
            left: formatDimension(
              direction === Direction.VERTICAL ? node.x : node.y
            ),
            top: formatDimension(
              direction === Direction.VERTICAL ? node.y : node.x
            ),
            width: formatDimension(config.nodeWidth),
            height: formatDimension(config.nodeHeight),
          }">
          <slot name="node" v-bind:node="node.data" v-bind:collapsed="node.data._collapsed">
            <span>{{ node.data.value }}</span>
          </slot>
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import TreeChartCore, {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_LEVEL_HEIGHT,
  TreeLinkStyle,
  Direction,
} from "../../../tree-chart-core/index.ts";

interface TreeConfig {
  nodeWidth?: number;
  nodeHeight?: number;
  levelHeight?: number;
  focusToNode?: boolean;
  initiallyCollapsed?: boolean;
  useMobileZoom?: boolean;
  useMouseZoom?: boolean;
  collapseDepth?: number;
}

interface NodeData {
  x: number;
  y: number;
  data: {
    _key: string;
    _collapsed: boolean;
    value: string;
    [key: string]: any;
  };
}

const formatDimension = (dimension: number | string): string => {
  if (typeof dimension === "number") return `${dimension}px`;
  if (typeof dimension === "string" && dimension.indexOf("px") !== -1) {
    return dimension;
  }
  return `${dimension}px`;
};

export default defineComponent({
  name: "VueTree",
  props: {
    config: {
      type: Object as () => TreeConfig,
      default: () => ({
        nodeWidth: DEFAULT_NODE_WIDTH,
        nodeHeight: DEFAULT_NODE_HEIGHT,
        levelHeight: DEFAULT_LEVEL_HEIGHT,
        focusToNode: false,
        initiallyCollapsed: false,
        useMobileZoom: false,
        useMouseZoom: false,
        collapseDepth: 0,
      }),
    },
    linkStyle: {
      type: String as () => TreeLinkStyle,
      default: TreeLinkStyle.CURVE,
    },
    direction: {
      type: String as () => Direction,
      default: Direction.VERTICAL,
    },
    collapseEnabled: {
      type: Boolean,
      default: true,
    },
    dataset: {
      type: [Object, Array] as () => any,
      required: true,
    },
  },
  setup(props) {
    const container = ref<HTMLElement | null>(null);
    const svg = ref<SVGSVGElement | null>(null);
    const domContainer = ref<HTMLElement | null>(null);
    const treeChartCore = ref<TreeChartCore | null>(null);
    const nodeDataList = ref<NodeData[]>([]);
    const initialTransformStyle = ref<Record<string, string>>({});

    const init = () => {
      if (!svg.value || !domContainer.value || !container.value) return;

      treeChartCore.value = new TreeChartCore({
        svgElement: svg.value,
        domElement: domContainer.value,
        treeContainer: container.value,
        dataset: props.dataset,
        direction: props.direction,
        treeConfig: props.config,
        collapseEnabled: props.collapseEnabled,
        linkStyle: props.linkStyle,
      });

      treeChartCore.value.init();
      nodeDataList.value = treeChartCore.value.getNodeDataList();
      initialTransformStyle.value = treeChartCore.value.getInitialTransformStyle();
    };

    const zoomIn = () => treeChartCore.value?.zoomIn();
    const zoomOut = () => treeChartCore.value?.zoomOut();
    const restoreScale = () => treeChartCore.value?.setScale(1);
    const expandNodeByLevelAndPosition = (level: number, position: number) => {
      treeChartCore.value?.expandNodeByLevelAndPosition(level, position);
      nodeDataList.value = treeChartCore.value?.getNodeDataList() || [];
    };
    const restorePosition = () => treeChartCore.value?.restorePosition();
    const onClickNode = (index: number) => {
      treeChartCore.value?.onClickNode(index);
      nodeDataList.value = treeChartCore.value?.getNodeDataList() || [];
      if (props.config.focusToNode) {
        focusToNode(index);
      }
    };
    const focusToNode = (index: number) => treeChartCore.value?.focusToNode(index);

    onMounted(() => {
      init();
    });

    onBeforeUnmount(() => {
      treeChartCore.value?.destroy();
    });

    watch(
      () => props.dataset,
      (newDataset) => {
        treeChartCore.value?.updateDataset(newDataset);
        nodeDataList.value = treeChartCore.value?.getNodeDataList() || [];
      },
      { deep: true }
    );

    return {
      container,
      svg,
      domContainer,
      nodeDataList,
      initialTransformStyle,
      formatDimension,
      Direction,
      zoomIn,
      zoomOut,
      restoreScale,
      expandNodeByLevelAndPosition,
      restorePosition,
      onClickNode,
      focusToNode,
    };
  },
});
</script>

<style>
.tree-container .node {
  fill: grey !important;
}

.tree-container .link {
  stroke-width: 2px !important;
  fill: transparent !important;
  stroke: #cecece !important;
}

.tree-container .link-hidden {
  display: none;
  stroke-width: 2px !important;
  fill: transparent !important;
  stroke: #FC2020FF !important;
}

.tree-node-item-enter,
.tree-node-item-leave-to {
  opacity: 0;
}

.tree-node-item-enter-active,
.tree-node-item-leave-active {

}

.tree-container {
  touch-action: none;
  position: relative;
  overflow: hidden;
}

.tree-container .vue-tree {
  position: relative;
}

.tree-container > svg,
.tree-container .dom-container {
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  transform-origin: 0 50%;
}

.tree-container .dom-container {
  z-index: 1;
  pointer-events: none;
}

.node-slot {
  cursor: pointer;
  pointer-events: all;
  position: absolute;
  background-color: transparent;
  box-sizing: border-box;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: content-box;
  transition-timing-function: ease-in-out;
}
</style>