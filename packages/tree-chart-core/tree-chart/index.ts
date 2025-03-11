import * as d3 from "d3";
import {
  ANIMATION_DURATION,
  DEFAULT_HEIGHT_DECREMENT,
  DEFAULT_LEVEL_HEIGHT,
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  MATCH_SCALE_REGEX,
  MATCH_TRANSLATE_REGEX,
} from "./constant";
import { TreeDataset, Direction, TreeLinkStyle } from "./tree-chart";
import { deepCopy, rotatePoint } from "./util";

// Define TreeNode interface
interface TreeNode {
  depth: number;
  children?: TreeNode[];
  _children?: TreeNode[];
  _collapsed?: boolean;
  _key?: string;
  name?: string;
  [key: string]: any;
}

interface TreeConfig {
  nodeWidth: number;
  nodeHeight: number;
  levelHeight: number;
  focusToNode: boolean;
  initiallyCollapsed: boolean;
  useMobileZoom?: boolean;
  useMouseZoom?: boolean;
  collapseDepth?: number;
}

interface TreeChartCoreParams {
  treeConfig?: TreeConfig;
  linkStyle?: TreeLinkStyle;
  direction?: Direction;
  collapseEnabled: boolean;
  dataset: TreeDataset;
  svgElement: SVGElement;
  domElement: HTMLDivElement;
  treeContainer: HTMLDivElement;
}

// Define proper D3 link types
interface D3Link {
  source: {
    x: number;
    y: number;
    data: any;
  };
  target: {
    x: number;
    y: number;
    data: any;
  };
}

export default class TreeChartCore {
  interactionMode: "drag" | "zoom" | null = null;
  treeConfig: TreeConfig = {
    nodeWidth: DEFAULT_NODE_WIDTH,
    nodeHeight: DEFAULT_NODE_HEIGHT,
    levelHeight: DEFAULT_LEVEL_HEIGHT,
    focusToNode: false,
    initiallyCollapsed: false,
    useMobileZoom: false,
    collapseDepth: 0, // default value
    useMouseZoom: false,
  };
  linkStyle: TreeLinkStyle = TreeLinkStyle.CURVE;
  direction: Direction = Direction.VERTICAL;
  collapseEnabled: boolean = true;

  dataset: TreeDataset;
  svgElement: SVGElement;
  svgSelection: any;
  domElement: HTMLDivElement;
  treeContainer: HTMLDivElement;

  nodeDataList: d3.HierarchyPointNode<any>[] = [];
  linkDataList: D3Link[] = [];
  initTransformX!: number;
  initTransformY!: number;

  currentScale: number = 1;

  constructor(params: TreeChartCoreParams) {
    if (params.treeConfig) {
      this.treeConfig = params.treeConfig;
    }
    this.collapseEnabled = params.collapseEnabled;
    this.svgElement = params.svgElement;
    this.domElement = params.domElement;
    this.treeContainer = params.treeContainer;
    this.dataset = this.updatedInternalData(params.dataset);
    if (params.direction) this.direction = params.direction;
    if (params.linkStyle) this.linkStyle = params.linkStyle;
  }

  async init() {
    this.draw();
    this.enableDrag();
    this.enablePinchZoom();
    this.enableMouseZoom();
    this.initTransform();

    //To Do: dont work at reload
    //this.expandNodeByLevelAndPosition(2, 1);
  }

  getNodeDataList() {
    return this.nodeDataList;
  }

  private enableMouseZoom() {
    if (!this.treeConfig.useMouseZoom) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      // zoom direction
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;

      //adjust zoom
      const originTransformStr = this.domElement.style.transform;
      const scaleMatchResult = originTransformStr.match(MATCH_SCALE_REGEX);
      const originScale = scaleMatchResult
        ? parseFloat(scaleMatchResult[1])
        : 1;

      // Calculate new scale
      const newScale = originScale * zoomFactor;
      this.setScale(newScale);
    };

    this.treeContainer.addEventListener("wheel", handleWheel, {
      passive: false,
    });
  }

  getInitialTransformStyle(): Record<string, string> {
    return {
      transform: `scale(1) translate(${this.initTransformX}px, ${this.initTransformY}px)`,
      transformOrigin: "center",
    };
  }

  private adjustZoom(factor: number) {
    const originTransformStr = this.domElement.style.transform;
    const scaleMatchResult = originTransformStr.match(MATCH_SCALE_REGEX);
    const originScale = scaleMatchResult ? parseFloat(scaleMatchResult[1]) : 1;
    this.setScale(originScale * factor);
  }

  zoomIn() {
    this.adjustZoom(1.2);
  }

  zoomOut() {
    this.adjustZoom(1 / 1.2);
  }

  private enablePinchZoom() {
    if (!this.treeConfig.useMobileZoom) return;

    let initialDistance: number | null = null;
    let initialScale: number = this.currentScale;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        this.interactionMode = "zoom"; // change interaction mode to zoom
        event.preventDefault();
        initialDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY 
        );
        initialScale = this.currentScale;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (
        this.interactionMode === "zoom" &&
        event.touches.length === 2 &&
        initialDistance !== null
      ) {
        event.preventDefault();
        const currentDistance = Math.hypot(
          event.touches[0].clientX - event.touches[1].clientX,
          event.touches[0].clientY - event.touches[1].clientY
        );
        const scale = (currentDistance / initialDistance) * initialScale;
        this.setScale(scale);
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        this.interactionMode = null;
        initialDistance = null;
      }
    };

    this.treeContainer.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    this.treeContainer.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    this.treeContainer.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    });
  }
  restoreScale() {
    this.setScale(1);
  }

  restorePosition() {
    // Enable transition for smooth animation
    this.svgElement.style.transition = "transform 0.4s ease";
    this.domElement.style.transition = "transform 0.4s ease";

    // Reset scale to 1 and translate to initial position
    const transformString = `scale(1) translate(${this.initTransformX}px, ${this.initTransformY}px)`;
    this.svgElement.style.transform = transformString;
    this.domElement.style.transform = transformString;

    // Reset current scale
    this.currentScale = 1;

    // Clear transition after animation
    setTimeout(() => {
      this.svgElement.style.transition = "";
      this.domElement.style.transition = "";
    }, 400); // Match the transition duration
  }

  setScale(scaleNum: number) {
    if (typeof scaleNum !== "number") return;
    const pos = this.getTranslate();
    const translateString = `translate(${pos[0]}px, ${pos[1]}px)`;
    this.svgElement.style.transform = `scale(${scaleNum}) ` + translateString;
    this.domElement.style.transform = `scale(${scaleNum}) ` + translateString;
    this.currentScale = scaleNum;
  }
  getTranslate() {
    const string = this.svgElement.style.transform;
    const match = string.match(MATCH_TRANSLATE_REGEX);
    if (match === null) {
      return [null, null];
    }
    const x = parseInt(match[1]);
    const y = parseInt(match[2]);
    return [x, y];
  }

  isVertical() {
    return this.direction === Direction.VERTICAL;
  }
  /**
   * 根据link数据,生成svg path data
   */
  private generateLinkPath(d: D3Link) {
    const self = this;
    if (this.linkStyle === TreeLinkStyle.CURVE) {
      return this.generateCurceLinkPath(self, d);
    }
    if (this.linkStyle === TreeLinkStyle.STRAIGHT) {
      // the link path is: source -> secondPoint -> thirdPoint -> target
      return this.generateStraightLinkPath(d);
    }
    return "";
  }

  private generateCurceLinkPath(self: this, d: D3Link) {
    // Fix for D3 linkHorizontal/linkVertical which expect [number, number] format
    // but we're using {x, y} format
    const linkPath = this.isVertical()
      ? d3.linkVertical<D3Link, any>()
      : d3.linkHorizontal<D3Link, any>();
    
    // Set accessor functions to return coordinates in the format D3 expects
    linkPath
      .x(function(this: any, point: any) {
        return point.x;
      })
      .y(function(this: any, point: any) {
        return point.y;
      })
      .source(function(this: any, d: D3Link) {
        const sourcePoint = {
          x: d.source.x,
          y: d.source.y,
        };
        return self.direction === Direction.VERTICAL
          ? sourcePoint
          : rotatePoint(sourcePoint);
      })
      .target(function(this: any, d: D3Link) {
        const targetPoint = {
          x: d.target.x,
          y: d.target.y,
        };
        return self.direction === Direction.VERTICAL
          ? targetPoint
          : rotatePoint(targetPoint);
      });
    
    return linkPath(d);
  }

  private generateStraightLinkPath(d: D3Link) {
    const linkPath = d3.path();
    let sourcePoint = { x: d.source.x, y: d.source.y };
    let targetPoint = { x: d.target.x, y: d.target.y };
    if (!this.isVertical()) {
      sourcePoint = rotatePoint(sourcePoint);
      targetPoint = rotatePoint(targetPoint);
    }
    const xOffset = targetPoint.x - sourcePoint.x;
    const yOffset = targetPoint.y - sourcePoint.y;
    const secondPoint = this.isVertical()
      ? { x: sourcePoint.x, y: sourcePoint.y + yOffset / 2 }
      : { x: sourcePoint.x + xOffset / 2, y: sourcePoint.y };
    const thirdPoint = this.isVertical()
      ? { x: targetPoint.x, y: sourcePoint.y + yOffset / 2 }
      : { x: sourcePoint.x + xOffset / 2, y: targetPoint.y };
    linkPath.moveTo(sourcePoint.x, sourcePoint.y);
    linkPath.lineTo(secondPoint.x, secondPoint.y);
    linkPath.lineTo(thirdPoint.x, thirdPoint.y);
    linkPath.lineTo(targetPoint.x, targetPoint.y);
    return linkPath.toString();
  }

  updateDataList() {
    const [nodeDataList, linkDataList] = this.buildTree();
    nodeDataList.splice(0, 1);
    
    // Fix the type issue by casting to the proper D3Link type
    this.linkDataList = linkDataList
      .filter((x: any) => x.source.data.name !== "__invisible_root") as D3Link[];
    this.nodeDataList = nodeDataList;
  }

  private draw() {
    this.updateDataList();
    const identifier = this.dataset["identifier"];
    const specialLinks = this.dataset["links"];
    if (specialLinks && identifier) {
      for (const link of specialLinks) {
        let parent,
          children = undefined;
        if (identifier === "value") {
          parent = this.nodeDataList.find((d) => {
            return d[identifier] == link.parent;
          });
          children = this.nodeDataList.filter((d) => {
            return d[identifier] == link.child;
          });
        } else {
          parent = this.nodeDataList.find((d) => {
            return d["data"][identifier] == link.parent;
          });
          children = this.nodeDataList.filter((d) => {
            return d["data"][identifier] == link.child;
          });
        }
        if (parent && children) {
          for (const child of children) {
            const new_link = {
              source: parent,
              target: child,
            } as D3Link;
            this.linkDataList.push(new_link);
          }
        }
      }
    }

    this.svgSelection = d3.select(this.svgElement);

    const self = this;
    const links = this.svgSelection
      .selectAll(".link")
      .data(this.linkDataList, (d: any) => {
        return `${d.source.data._key}-${d.target.data._key}`;
      });

    links
      .enter()
      .append("path")
      .style("opacity", 0)
      .transition()
      .duration(ANIMATION_DURATION)
      .ease(d3.easeCubicInOut)
      .style("opacity", 1)
      //.attr("class", "link")
      .attr("class", (d: any) => (d.source.depth === 1 ? "link-hidden" : "link")) // 1 are the branches of the root node
      .attr("d", function (d) {
        return self.generateLinkPath(d);
      });
    links
      .transition()
      .duration(ANIMATION_DURATION)
      .ease(d3.easeCubicInOut)
      .attr("d", function (d) {
        return self.generateLinkPath(d);
      });
    links
      .exit()
      .transition()
      .duration(ANIMATION_DURATION / 2)
      .ease(d3.easeCubicInOut)
      .style("opacity", 0)
      .remove();
  }

  private assignDepth(node: TreeNode, currentDepth: number) {
    node.depth = currentDepth;

    if (node.children) {
      node.children.forEach((child) =>
        this.assignDepth(child, currentDepth + 1)
      );
    }
  }

  /**
   * Returns updated dataset by deep copying every nodes from the externalData and adding unique '_key' attributes.
   **/
  private updatedInternalData(externalData: TreeDataset | TreeDataset[]) {
    const data: { name: string; children: TreeDataset[] } = {
      name: "__invisible_root",
      children: [],
    };
    if (!externalData) return data;

    const minExpandedDepth = this.treeConfig.collapseDepth; // min level to expand nodes (-1 is the root)

    if (Array.isArray(externalData)) {
      for (let i = externalData.length - 1; i >= 0; i--) {
        const rootNode = deepCopy(externalData[i]);
        this.assignDepth(rootNode as TreeNode, 0);
        if (this.treeConfig.initiallyCollapsed) {
          this.collapseAllNodes(rootNode);
        }
        this.expandNodesByDepth(rootNode as TreeNode, minExpandedDepth || 0);
        data.children.push(rootNode);
      }
    } else {
      const rootNode = deepCopy(externalData);
      this.assignDepth(rootNode as TreeNode, 0);
      if (this.treeConfig.initiallyCollapsed) {
        this.collapseAllNodes(rootNode);
      }
      this.expandNodesByDepth(rootNode as TreeNode, minExpandedDepth || 0);
      data.children.push(rootNode);
    }

    return data;
  }

  private collapseAllNodes(node: any) {
    if (node.children) {
      node._children = node.children;
      node.children = null;
      node._collapsed = true;
      node._children.forEach((child: any) => this.collapseAllNodes(child));
    }
  }

  private expandNodesByDepth(node: TreeNode, minDepth: number): void {
    if (node.depth > minDepth) {
      return;
    }

    if (node.depth <= minDepth && node._children) {
      node.children = node._children;
      node._children = null;
      node._collapsed = false;
    }
    node.children?.forEach((child) => this.expandNodesByDepth(child, minDepth));
  }

  private buildTree(): [d3.HierarchyPointNode<any>[], d3.HierarchyPointLink<any>[]] {
    const treeBuilder = d3
      .tree()
      .nodeSize([this.treeConfig.nodeWidth, this.treeConfig.levelHeight]);
    const tree = treeBuilder(d3.hierarchy(this.dataset));
    return [tree.descendants(), tree.links()];
  }

  private enableDrag() {
    let startX = 0;
    let startY = 0;
    let isDrag = false;
    let mouseDownTransform = "";

    this.treeContainer.onpointerdown = (event) => {
      if (this.interactionMode !== null) return;
      this.cancelTransition(); // cancel transition to avoid conflict with drag

      this.interactionMode = "drag";
      mouseDownTransform = this.svgElement.style.transform;
      startX = event.clientX;
      startY = event.clientY;
      isDrag = true;
    };

    this.treeContainer.onpointermove = (event) => {
      if (!isDrag || this.interactionMode !== "drag") return;

      const originTransform = mouseDownTransform;
      let originOffsetX = 0;
      let originOffsetY = 0;
      if (originTransform) {
        const result = originTransform.match(MATCH_TRANSLATE_REGEX);
        if (result !== null && result.length !== 0) {
          const [offsetX, offsetY] = result.slice(1);
          originOffsetX = parseInt(offsetX);
          originOffsetY = parseInt(offsetY);
        }
      }

      const newX =
        Math.floor((event.clientX - startX) / this.currentScale) +
        originOffsetX;
      const newY =
        Math.floor((event.clientY - startY) / this.currentScale) +
        originOffsetY;
      let transformStr = `translate(${newX}px, ${newY}px)`;
      if (originTransform) {
        transformStr = originTransform.replace(
          MATCH_TRANSLATE_REGEX,
          transformStr
        );
      }
      this.svgElement.style.transform = transformStr;
      this.domElement.style.transform = transformStr;
    };

    this.treeContainer.onpointerup = () => {
      startX = 0;
      startY = 0;
      isDrag = false;
      this.interactionMode = null;
    };
  }

  private cancelTransition() {
    this.svgElement.style.transition = "none";
    this.domElement.style.transition = "none";
    const currentTransform = this.svgElement.style.transform;
    this.svgElement.style.transform = currentTransform;
    this.domElement.style.transform = currentTransform;
  }
  public reinitTransform() {
    this.initTransform();
  }
  private initTransform() {
    requestAnimationFrame(() => {
      const containerWidth = this.domElement.offsetWidth;
      const containerHeight = this.domElement.offsetHeight;

      if (this.isVertical()) {
        this.initTransformX = Math.floor(containerWidth / 2);
        this.initTransformY = Math.floor(
          this.treeConfig.nodeHeight - DEFAULT_HEIGHT_DECREMENT
        );
      } else {
        this.initTransformX = Math.floor(
          this.treeConfig.nodeWidth - DEFAULT_HEIGHT_DECREMENT
        );
        this.initTransformY = Math.floor(containerHeight / 2);
      }
      // Apply initial transform
      const transformStyle = this.getInitialTransformStyle();
      this.svgElement.style.transform = transformStyle.transform;
      this.domElement.style.transform = transformStyle.transform;
    });
  }
  private collapseNodesAtSameLevel(clickedNode: any) {
    // Find the parent node to get siblings
    const parent = this.nodeDataList.find(
      (node) =>
        node.data.children?.some(
          (child) => child._key === clickedNode.data._key
        ) ||
        node.data._children?.some(
          (child) => child._key === clickedNode.data._key
        )
    );

    if (!parent) return;

    // Get all siblings (including the clicked node)
    const siblings = parent.data.children || [];

    // Collapse all siblings except the clicked node
    siblings.forEach((sibling) => {
      if (sibling._key !== clickedNode.data._key) {
        if (sibling.children) {
          sibling._children = sibling.children;
          sibling.children = null;
          sibling._collapsed = true;
        }
      }
    });
  }

  onClickNode(index: number) {
    //dont collapse the root node
    if (index === 0) return;
    if (this.collapseEnabled) {
      const curNode = this.nodeDataList[index];

      if (curNode.data.children) {
        curNode.data._children = curNode.data.children;
        curNode.data.children = null;
        curNode.data._collapsed = true;
      } else {
        curNode.data.children = curNode.data._children;
        curNode.data._children = null;
        curNode.data._collapsed = false;

        // When expanding a node, collapse its siblings
        this.collapseNodesAtSameLevel(curNode);
      }

      this.draw();
    }
  }

  public expandNodeByLevelAndPosition(level: number, nodeIndex: number) {
    const nodesAtLevel = this.nodeDataList.filter(
      (node) => node.depth === level
    );

    if (nodeIndex < 0 || nodeIndex >= nodesAtLevel.length) {
      console.error("Node not found at level", level, "position", nodeIndex);
      return;
    }
    const targetNode = nodesAtLevel[nodeIndex];
    const nodeData = targetNode.data;

    if (nodeData._children) {
      nodeData.children = nodeData._children;
      nodeData._children = null;
      nodeData._collapsed = false;
      this.draw();
    }
  }

  private collapseSiblingNodes(node: any) {
    const parent = this.nodeDataList.find(
      (n) =>
        n.data.children?.some((child: any) => child._key === node.data._key) ||
        n.data._children?.some((child: any) => child._key === node.data._key)
    );
    if (parent) {
      parent.data.children?.forEach((child: any) => {
        if (child._key !== node.data._key && child.children) {
          child._children = child.children;
          child.children = null;
          child._collapsed = true;
        }
      });
    }
  }

  /**
   * Focus on a specific node in the tree
   * @param index Index of the node to focus on
   */
  focusToNode(index: number) {
    //this.restoreScale();
    if (!this.treeConfig.focusToNode) return;

    if (!this.nodeDataList || index < 0 || index >= this.nodeDataList.length) {
      return;
    }

    const node = this.nodeDataList[index];
    const containerWidth = this.domElement.offsetWidth;
    const containerHeight = this.domElement.offsetHeight;
    const nodeX = this.isVertical() ? node.x : node.y;
    const nodeY = this.isVertical() ? node.y : node.x;
    const translateX = Math.floor(containerWidth / 2 - nodeX);

    const translateY = Math.floor(
      containerHeight / 2 - nodeY - DEFAULT_NODE_HEIGHT * 2 - 10
    ); // -2 nodes to center the diagram +10 of root node
    const transformString = `scale(${this.currentScale}) translate(${translateX}px, ${translateY}px)`;

    this.svgElement.style.transition = "transform 0.3s ease";
    this.domElement.style.transition = "transform 0.3s ease";
    this.svgElement.style.transform = transformString;
    this.domElement.style.transform = transformString;
  }

  /**
   * call this function to update dataset
   * notice : you need to update the view rendered by `nodeDataList` too
   * @param dataset the new dataset to show in chart
   */
  updateDataset(dataset: TreeDataset) {
    this.dataset = this.updatedInternalData(dataset);
    this.draw();
  }

  /**
   * release all dom reference
   */
  destroy() {
    this.svgElement = null as unknown as SVGElement;
    this.domElement = null as unknown as HTMLDivElement;
    this.treeContainer = null as unknown as HTMLDivElement;
  }
}