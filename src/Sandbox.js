import React from "react";

import Form from "react-jsonschema-form";

import "./css/Sandbox.css";
import "./css/Bootstrap.css";

import defaultConfig from "./sandbox_data/graph.config";//"react-d3-graph/src/components/graph/graph.config";
import { Graph } from "react-d3-graph";

import utils from "./SandboxUtils";
import reactD3GraphUtils from "react-d3-graph/src/utils";
import { JsonTree } from "react-editable-json-tree";
import { AddNodeDropdown } from "./AddNodeDropdown";
import { AddLinkDropdown } from "./AddLinkDropdown";
import { CollapseNodeDropdown } from "./CollapseNodeDropdown";
import { GraphDataFolder } from "./GraphDataFolder";
import { NodeMenu } from "./NodeMenu";

import { Dropdown, Button, ButtonToolbar, InputGroup } from "react-bootstrap";
import { FaRegEyeSlash } from 'react-icons/fa';

import uuidv1 from "uuid/v1";

const sandboxData = utils.loadDataset();

/**
 * This is a sample integration of react-d3-graph, in this particular case all the rd3g config properties
 * will be exposed in a form in order to allow on the fly graph configuration.
 * The data and configuration that are initially loaded can be manipulated via queryParameter on this same
 * Sandbox. You can dynamically load different datasets that are under the `data` folder. If you want
 * for instance to load the data and config under the `small` folder you just need to append "?data=small"
 * to the url when accessing the sandbox.
 */
export default class Sandbox extends React.Component {
  constructor(props) {
    super(props);

    const { config: configOverride, data, fullscreen } = sandboxData;

    // configOverride.nodeHighlightBehavior = true;
    // configOverride.node = { highlightStrokeColor: 'blue', labelProperty: 'name' };
    // configOverride.link = { highlightColor: 'blue' };

    const config = Object.assign(defaultConfig, configOverride);

    const schemaProps = utils.generateFormSchema(config, "", {});

    const schema = {
      type: "object",
      properties: schemaProps,
    };

    const uiSchema = {
      height: { "ui:readonly": "true" },
      width: { "ui:readonly": "true" },
    };

    this.uiSchema = uiSchema;

    this.state = {
      config,
      generatedConfig: {},
      schema,
      data,
      title: "",
      fullscreen,
      selectedNodes: [],
      selectedLinks: [],
      multiSelect: false,
      ctrlKeyDown: false,
      showNodeMenu: false,
      nodeMenuCoords: {},
      nodeTypeConfig: {},
      visibleNodes: {},
      nodeIdToBeRemoved: null,
    };
  };

  /**
    * Replace the current graph with the newly loaded one
    */
  loadGraphData = (filename, graphData) => {
    const title = filename.split(".json")[0];

    console.log("loadGraphData: ", utils.applyNodeTypeConfig(graphData.nodes, graphData.nodeTypes));

    // TODO - apply styles to nodes

    this.setState({ 
      title: title,
      data: { nodes: utils.applyNodeTypeConfig(graphData.nodes, graphData.nodeTypes), links: graphData.links },
      nodeTypeConfig: graphData.nodeTypes || {}
    });
  };

  hasSelection = () => {
    return this.hasNodeSelection() || this.selectedData().links.length > 0;
  };

  hasNodeSelection = () => {
    return this.selectedData().nodes.length > 0;
  };

  isNodeSelected = (nodeId) => {
    if (this.selectedData().nodes.length < 1) return false;

    return this.state.selectedNodes.map(n => n.id).includes(nodeId);
  };

  selectedData = () => {
    return {
      nodes: this.state.selectedNodes,
      links: this.state.selectedLinks
    }
  };

  selectNode = (nodeId) => {
    let selectedNodes = this.state.selectedNodes;
    const nodeData = utils.getNodeData(nodeId, this.state.data.nodes);
    const selectedNodeIndex = selectedNodes.findIndex(n => n.id == nodeId);

    // multi-select
    if (this.state.ctrlKeyDown || this.state.multiSelect) {
      if (selectedNodeIndex < 0) {
        selectedNodes = this.state.selectedNodes;
        selectedNodes.push(nodeData);
      }
      // deselect 
      else {
        selectedNodes.splice(selectedNodeIndex, 1);
      }
    }
    else {
      selectedNodes = [nodeData];
    }
    
    this.setState({ 
      selectedNodes: selectedNodes, 
      selectedLinks: [],
      showNodeMenu: false 
    });
  };

  selectLink = (source, target) => {
    const selectedLinks = [utils.getLinkData(source, target, this.state.data.links)];
    this.setState({ 
      selectedNodes: [],
      selectedLinks: selectedLinks,
    });
  };

  onClickGraph = () => {
    // clear selection
    this.setState({
      selectedNodes: [],
      selectedLinks: [],
      showNodeMenu: false
    });
  };

  handleNodeDragMove = (nodeId, x, y) => {
    let nodes = this.state.data.nodes;
    let movedNodeIndex = nodes.findIndex(n => n.id == nodeId);
    nodes[movedNodeIndex].fx = x;
    nodes[movedNodeIndex].fy = y;

    this.setState({
      data: {
        links: this.state.data.links,
        nodes: nodes
      }
    });
  };

  // handle dragging of all selected nodes
  handleSelectionDragMove = (dx, dy) => {
    const selectedNodeIds = this.state.selectedNodes.map(n => n.id);
    let nodes = this.state.data.nodes;
    nodes.forEach(node => {
      // if node.id in selectedNodes
      if (selectedNodeIds.includes(node.id)) {
          node.fx += dx;
          node.fy += dy;
      }
    });

    this.setState({
      data: {
        links: this.state.data.links,
        nodes: nodes
      }
    });
  };

  
  /**
   * Sets on/off fullscreen visualization mode.
   */
  onToggleFullScreen = () => {
    const fullscreen = !this.state.fullscreen;

    this.setState({ fullscreen });
  };

  onClickSave = () => {
    const reqData = {
      title: this.state.title,
      graph: { 
        nodes: this.state.data.nodes,
        links: this.state.data.links,
        nodeTypes: this.state.nodeTypeConfig
      }
    };

    // refactor this into a postData method implementation: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    fetch("/api/graph/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(reqData)
    })
    .then(response => response.json());
  };

  /**
   * Play stopped animations.
   */
  restartGraphSimulation = () => this.refs.graph.restartSimulation();

  /**
   * Pause ongoing animations.
   */
  pauseGraphSimulation = () => this.refs.graph.pauseSimulation();

  /**
   * If you have moved nodes you will have them restore theirs positions
   * when you call resetNodesPositions.
   */
  resetNodesPositions = () => this.refs.graph.resetNodesPositions();

  /**
   * Append a new node with some randomness.
   */
  addNode = (nodeData) => {
    if (this.state.data.nodes && this.state.data.nodes.length) {
      const newNodeId = uuidv1();//`Node ${this.state.data.nodes.length}`;

      const newNode = {
        id: newNodeId, 
        name: nodeData.name,
        nodeType: nodeData.nodeType
      };
      const nodes = [...this.state.data.nodes, newNode];
      
      this.setState({
        data: {
          nodes: utils.applyNodeTypeConfig(nodes, this.state.nodeTypeConfig),
          links: this.state.data.links
        },
      });
    } else {
      // 1st node
      const data = {
        nodes: [{ 
        id: "Node 1",
        name: nodeData.name,
        nodeType: nodeData.nodeType,
        symbolType: nodeData.symbolType
        }],
        links: [],
      };

      this.setState({ data });
    }
  };

  addLink = (linkData) => {
    this.state.data.links.push(linkData);
    this.setState({ data: this.state.data });
  };

  /**
   * Remove a node.
   */
  // onClickRemoveNode = () => {
  //   if (this.state.data.nodes && this.state.data.nodes.length) {
  //     const id = this.state.data.nodes[0].id;

  //     this.state.data.nodes.splice(0, 1);
  //     const links = this.state.data.links.filter(l => l.source !== id && l.target !== id);
  //     const data = { nodes: this.state.data.nodes, links };

  //     this.setState({ data });
  //   } else {
  //     console.log("No more nodes to remove!");
  //   }
  // };

  // _buildGraphConfig = data => {
  //   let config = {};
  //   let schemaPropsValues = {};

  //   for (let k of Object.keys(data.formData)) {
  //     // Set value mapping correctly for config object of react-d3-graph
  //     utils.setValue(config, k, data.formData[k]);
  //     // Set new values for schema of jsonform
  //     schemaPropsValues[k] = {};
  //     schemaPropsValues[k]["default"] = data.formData[k];
  //   }

  //   return { config, schemaPropsValues };
  // };

  // refreshGraph = data => {
  //   const { config, schemaPropsValues } = this._buildGraphConfig(data);

  //   this.state.schema.properties = reactD3GraphUtils.merge(this.state.schema.properties, schemaPropsValues);

  //   this.setState({
  //     config,
  //   });
  // };

  /**
   * Generate graph configuration file ready to use!
   */
  // onSubmit = data => {
  //   const { config } = this._buildGraphConfig(data);

  //   this.setState({ generatedConfig: config });
  // };

  onClickSubmit = () => {
    // Hack for allow submit button to live outside jsonform
    document.body.querySelector(".invisible-button").click();
  };

  onDragStartGraph = () => {
    console.log('dragging graph');
  };

  onGraphKeyDown = (e) => {
    const key = e.keyCode || e.charCode;

    if (key == 46 && (Object.keys(this.state.selectedNodes).length > 0 || Object.keys(this.state.selectedLinks).length > 0)) {
      const updatedData = utils.removeSelectedData(
        this.state.data.nodes, 
        this.state.selectedNodes.map(n => n.id),
        this.state.data.links,
        this.state.selectedLinks
      );

      this.setState({ data: updatedData });
    }

    if (e.ctrlKey) {
      this.setState({ ctrlKeyDown: true });
    }

    // ctrl + C
    if (this.state.ctrlKeyDown && key === 67) {
      console.log("TODO - copy");
      this.handleCopySelection();
    }

    // ctrl + V
    if (this.state.ctrlKeyDown && key === 86) {
      console.log("TODO - paste");
    }

    // ctrl + Q
    if (this.state.ctrlKeyDown && key == 81) {
      // TODO - trigger on rightclick as well
      this.showNodeMenu();
    }
  };

  onGraphKeyUp = (e) => {
    this.setState({ ctrlKeyDown: false });
  };

  handleTitleChange = (e) => {
    this.setState({ title: e.target.value });
  };

  showNodeMenu = () => {
    if (!this.hasNodeSelection()) return;

    const selectedNode = this.state.selectedNodes[0];
    let nodeCoords = this.refs.graph.getNodeCoords(selectedNode.id);
    console.log(nodeCoords);

    // account for the menu bar height
    nodeCoords.y += 100;

    this.setState({ showNodeMenu: true, nodeMenuCoords: nodeCoords });
  };

  resetGraphConfig = () => {
    const generatedConfig = {};

    const schemaProps = utils.generateFormSchema(defaultConfig, "", {});

    const schema = {
      type: "object",
      properties: schemaProps,
    };

    this.setState({
      config: defaultConfig,
      generatedConfig,
      schema,
    });
  };

  /**
   * This function decorates nodes and links with positions. The motivation
   * for this function its to set `config.staticGraph` to true on the first render
   * call, and to get nodes and links statically set to their initial positions.
   * @param  {Object} nodes nodes and links with minimalist structure.
   * @return {Object} the graph where now nodes containing (x,y) coords.
   */
  decorateGraphNodesWithInitialPositioning = nodes => {
    return nodes.map(n =>
      Object.assign({}, n, {
        x: n.x || Math.floor(Math.random() * 500),
        y: n.y || Math.floor(Math.random() * 500),
      })
    );
  };

  // TODO - implement
  applyNodeVisibility = nodes => {
    return nodes.map(n => {
      // nodes that display by default
      if (n.hidden === false) return n;

      return Object.assign({}, n, {
        hidden: !this.state.visibleNodes[n.id]
      });
    });
  }

  /**
   * Before removing elements (nodes, links)
   * from the graph data, this function is executed.
   * https://github.com/oxyno-zeta/react-editable-json-tree#beforeremoveaction
   */
  onBeforeRemoveGraphData = (key, keyPath, deep, oldValue) => {
    if (keyPath && keyPath[0] && keyPath[0] === "nodes" && oldValue && oldValue.id) {
      this.setState({
        nodeIdToBeRemoved: oldValue.id,
      });
    }

    return Promise.resolve();
  };

  /**
   * Update graph data each time an update is triggered
   * by JsonTree
   * @param {Object} data update graph data (nodes and links)
   */
  onGraphDataUpdate = data => {
    const removedNodeIndex = data.nodes.findIndex(n => !n);
    let removedNodeId = null;

    if (removedNodeIndex !== -1 && this.state.nodeIdToBeRemoved) {
      removedNodeId = this.state.nodeIdToBeRemoved;
    }

    const nodes = data.nodes.filter(Boolean);
    const isValidLink = link => link && link.source !== removedNodeId && link.target !== removedNodeId;
    const links = data.links.filter(isValidLink);

    this.setState({
      data: {
        links,
        nodes,
      },
    });
  };

  /**
   * Before attributes from the selected node/edge are removed, this function is executed.
   * https://github.com/oxyno-zeta/react-editable-json-tree#beforeremoveaction
   */
  onBeforeRemoveNodeAttr = (key, keyPath, deep, oldValue) => {
    console.log(key, keyPath, deep, oldValue);
    return Promise.resolve();
  };

  /**
   * Update node data each time an update is triggered
   * by JsonTree
   */
  onSelectedNodesUpdate = nodes => {
    let updatedNodes = this.state.data.nodes;

    nodes.forEach(node => {
      const nodeIndex = updatedNodes.findIndex(n => n.id == node.id);
      updatedNodes[nodeIndex] = node;
    });

    this.setState({
      data: {
        links: this.state.data.links,
        nodes: utils.applyNodeTypeConfig(updatedNodes, this.state.nodeTypeConfig)
      }
    });
  };

  /**
   * Update node data each time an update is triggered
   * by JsonTree
   */
  onSelectedLinksUpdate = links => {
    let updatedLinks = this.state.data.links;
    
    links.forEach(newLink => {
      const linkIndex = updatedLinks.findIndex(link => link.source == newLink.source && link.target == newLink.target);
      updatedLinks[linkIndex] = newLink;
    });

    this.setState({
      data: {
        nodes: this.state.data.nodes,
        links: updatedLinks
      }
    });
  };

  // collapse parent nodes of the selected node
  // Use breadth-first search, and mark visited nodes as hidden
  // allow for custom filter conditions 
  handleCollapseIncomingClick = () => {
    const collapseByNode = this.state.selectedNodes.length === 1;
    const collapseByLink = this.state.selectedLinks.length === 1;

    if (!collapseByLink && !collapseByNode) return;

    let selectedNode = {};
    let selectedLink = {};
    let collapsedState = true; 

    // BFS implementation
    let visited = {};
    let queue = [];

    if (collapseByNode) {
      selectedNode = this.state.selectedNodes[0];
      queue.push(selectedNode.id);
      collapsedState = !selectedNode.collapsed;
    }
    else if (collapseByLink) {
      selectedLink = this.state.selectedLinks[0];
      queue.push(selectedLink.source);
    }

    while (queue.length > 0) {
      let currNodeId = queue.shift();
      let incomingLinks = this.state.data.links.filter(link => {
        return link.target == currNodeId;
      });

      incomingLinks.forEach(link => {
        let sourceId = link.source;

        if (visited[sourceId] !== true) {
          queue.push(sourceId);
          visited[sourceId] = true;
        }
      });
    };

    // Mark all visited node to hidden
    let nodes = this.state.data.nodes.map(node => {
      if ((collapseByNode && visited[node.id] === true && node.id !== selectedNode.id) || (collapseByLink && visited[node.id] === true) || (collapseByLink && node.id === selectedLink.source)) {
        node.hidden = collapsedState;
      }
      return node;
    });

    // update collapsed state in graph data
    const selectedNodeIndex = collapseByNode ? nodes.findIndex(n => n.id == selectedNode.id) : nodes.findIndex(n => n.id == selectedLink.target);
    nodes[selectedNodeIndex].collapsed = collapsedState;

    this.setState({
      data: {
        links: this.state.data.links,
        nodes: nodes
      }
    })
  };

  // TODO - implement a way to unhide node?
  handleHideNodes = () => {
    if (this.state.selectedNodes.length < 1) return;

    const nodes = this.state.data.nodes.map(node => {
      if (this.isNodeSelected(node.id)) {
        node.hidden = true;
      }
      return node;
    });

    this.setState({
      data: {
        links: this.state.data.links,
        nodes: nodes
      }
    })
  };

  /**
   * Update node data each time an update is triggered
   * by JsonTree
   */
  onNodeTypeConfigUpdate = config => {
    console.log("onNodeTypeConfigUpdate: ", config);

    this.setState({
      nodeTypeConfig: config,
      data: {
        links: this.state.data.links,
        nodes: utils.applyNodeTypeConfig(this.state.data.nodes, config)
      }
    });
  };

  

  buildNodeMenu = () => {
    if (this.state.showNodeMenu && this.state.selectedNodes.length === 1) {

      const selectedNode = this.state.selectedNodes[0];
      const connectedNodes = utils.getConnectedNodes(selectedNode.id, this.state.data.nodes, this.state.data.links);
      const connectedTypes = utils.getConnectedTypes(selectedNode.id, this.state.data.nodes, this.state.data.links);
    
      return <NodeMenu 
        coords={this.state.nodeMenuCoords} 
        selectedNode={selectedNode}
        connectedTypes={connectedTypes} />;

      // return <div style={{
      //     left: this.state.nodeMenuCoords.x,
      //     top: this.state.nodeMenuCoords.y,
      //     width: "300px", 
      //     border: "1px solid black", 
      //     position: "absolute",
      //     zIndex: 1,
      //     backgroundColor: "white",
      //     padding: "1em"
      //   }}>
        
      //   <strong><p>Incoming Connections</p></strong>
      //   {incomingNodeComponents}

      //   <strong><p>Outgoing Connections</p></strong>
      //   {outgoingNodeComponents}
      // </div>;
    }
    else {
      return <div></div>;
    }
  };

  /**
   * Build common piece of the interface that contains some interactions such as
   * fullscreen, play/pause, + and - buttons.
   */
  buildCommonInteractionsPanel = () => {
    const btnStyle = {
      cursor: this.state.config.staticGraph ? "not-allowed" : "pointer",
    };

    const fullscreen = this.state.fullscreen ? (
      <span className="cross-icon" onClick={this.onToggleFullScreen}>
        ❌
      </span>
    ) : (
      <button onClick={this.onToggleFullScreen} className="btn btn-default btn-margin-left">
        Fullscreen
      </button>
    );

    return (
      <div>
        <InputGroup className="mb-3">
          <input 
            name="graph_title"
            value={this.state.title}
            placeholder="Title"
            onChange={this.handleTitleChange}
            className="form-control" />
          <Button 
            variant="success"
            onClick={this.onClickSave}>
            Save
          </Button>
        </InputGroup>

        <ButtonToolbar className="mb-3">
          <Dropdown>
            <Dropdown.Toggle variant="primary" id="dropdown-basic">
              + Add Node
            </Dropdown.Toggle> 

            <Dropdown.Menu 
              as={AddNodeDropdown} 
              addNode={this.addNode}
              nodeTypeConfig={this.state.nodeTypeConfig}
              title="Create a new node" >
            </Dropdown.Menu>
          </Dropdown> 

          <Dropdown>
            <Dropdown.Toggle variant="primary">
              + Add Link
            </Dropdown.Toggle> 

            <Dropdown.Menu 
              as={AddLinkDropdown} 
              addLink={this.addLink}
              title="Create a new link"
              nodes={this.state.data.nodes} >
            </Dropdown.Menu>
          </Dropdown>

          {fullscreen}
          
          <button onClick={this.handleCollapseIncomingClick}>Collapse</button>

          <button onClick={this.handleHideNodes}><FaRegEyeSlash /></button>

          {/*
          <Dropdown>
            <Dropdown.Toggle variant="default">
              <FaRegEye />
            </Dropdown.Toggle> 

            <Dropdown.Menu 
              as={CollapseNodeDropdown} 
              graphData={this.state.data}
              selectedNodes={this.state.selectedNodes} >
            </Dropdown.Menu>
          </Dropdown>

          <button
            onClick={this.resetNodesPositions}
            className="btn btn-default btn-margin-left"
            style={btnStyle}
            disabled={this.state.config.staticGraph}
          >
            Unstick nodes
          </button> 
          */}
        </ButtonToolbar>
        {/*
          <button
            onClick={this.restartGraphSimulation}
            className="btn btn-default btn-margin-left"
            style={btnStyle}
            disabled={this.state.config.staticGraph}
          >
            ▶️
          </button>
          <button
            onClick={this.pauseGraphSimulation}
            className="btn btn-default btn-margin-left"
            style={btnStyle}
            disabled={this.state.config.staticGraph}
          >
            ⏸️
          </button>
        */}
        
        {/*
          <button onClick={this.onClickRemoveNode} className="btn btn-default btn-margin-left">
          -
          </button>
        */}
      </div>
    );
  };

  render() {
    // This does not happens in this sandbox scenario running time, but if we set staticGraph config
    // to true in the constructor we will provide nodes with initial positions

    const nodesWithInitialPositioning = this.decorateGraphNodesWithInitialPositioning(this.state.data.nodes);

    const data = {
      nodes: this.applyNodeVisibility(nodesWithInitialPositioning),
      links: this.state.data.links,
      focusedNodeId: this.state.data.focusedNodeId,
    };

    const graphProps = {
      id: "graph",
      data,
      config: this.state.config,  // TODO - replace the state config with config file - ONE source of truth only
      // onClickNode: this.onClickNode,
      selectNode: this.selectNode,
      selectedNodes: this.state.selectedNodes,
      selectLink: this.selectLink,
      selectedLinks: this.state.selectedLinks,
      selectedData: this.selectedData,
      hasSelection: this.hasSelection,
      handleNodeDragMove: this.handleNodeDragMove,
      handleSelectionDragMove: this.handleSelectionDragMove,
      // onDoubleClickNode: this.onDoubleClickNode,
      // onRightClickNode: this.onRightClickNode,
      onClickGraph: this.onClickGraph,
      // onClickLink: this.onClickLink,
      // onRightClickLink: this.onRightClickLink,
      // onMouseOverNode: this.onMouseOverNode,
      // onMouseOutNode: this.onMouseOutNode,
      // onMouseOverLink: this.onMouseOverLink,
      // onMouseOutLink: this.onMouseOutLink,
      // onDragStart: this.onDragStartGraph
    };

    if (this.state.fullscreen) {
      graphProps.config = Object.assign({}, graphProps.config, {
        height: window.innerHeight,
        width: window.innerWidth,
      });

      return (
        <div 
          onKeyDown={this.onGraphKeyDown}
          onKeyUp={this.onGraphKeyUp}
          tabIndex="0">
          {this.buildCommonInteractionsPanel()}
          <Graph ref="graph" {...graphProps} />
        </div>
      );
    } else {
      // @TODO: Only show configs that differ from default ones in "Your config" box
      return (
        <div>
          <div className="container__graph">
            {this.buildCommonInteractionsPanel()}
            <div className="container__graph-area"
              onKeyDown={this.onGraphKeyDown}
              onKeyUp={this.onGraphKeyUp}
              tabIndex="0">
              <Graph ref="graph" {...graphProps} />
            </div>
            <span className="container__graph-info">
            Nodes: {this.state.data.nodes.length} | Links: {this.state.data.links.length}
          </span>
        <div 
          className="container"
          >
          </div>
          {/*<div className="container__form">
            <h4>
              <a href="https://github.com/danielcaldas/react-d3-graph" target="_blank">
                react-d3-graph
              </a>
            </h4>
            <h4>
              <a href="https://danielcaldas.github.io/react-d3-graph/docs/index.html" target="_blank">
                docs
              </a>
            </h4>
            <h3>Configurations</h3>
            <Form
              className="form-wrapper"
              schema={this.state.schema}
              uiSchema={this.uiSchema}
              onChange={this.refreshGraph}
              onSubmit={this.onSubmit}
            >
              <button className="invisible-button" type="submit" />
            </Form>
            <button className="submit-button btn btn-primary" onClick={this.onClickSubmit}>
              Generate config
            </button>
            <button className="reset-button btn btn-danger" onClick={this.resetGraphConfig}>
              Reset config
            </button>
          </div>
          <div className="container__graph-config">
            <h4>Your config</h4>
            <JSONContainer data={this.state.generatedConfig} staticData={false} />
          </div>
          */}
          
          <div className="container__graph-selected">
            <h4>Selected Nodes/Edges</h4>
            <div className="json-data-container">
              <JsonTree
                data={this.state.selectedNodes}
                beforeRemoveAction={this.onBeforeRemoveNodeAttr}
                onFullyUpdate={this.onSelectedNodesUpdate}
                rootName="Nodes"
              />
            </div>
            <div className="json-data-container">
              <JsonTree
                data={this.state.selectedLinks}
                beforeRemoveAction={this.onBeforeRemoveLinkAttr}
                onFullyUpdate={this.onSelectedLinksUpdate}
                rootName="Links"
              />
            </div>
          </div>

          <div className="container__graph-files">
            <h4>Data Files</h4>
            <p>Click on the filename to load the graph</p>

            <GraphDataFolder
              loadGraphData={this.loadGraphData} />
          </div>

          <div className="container__graph-legend">
            <h4>Legend</h4>
            <JsonTree
                data={this.state.nodeTypeConfig}
                onFullyUpdate={this.onNodeTypeConfigUpdate}
                rootName="Node Types"
              />
          </div>

          {/*<div className="container__graph-data">
            <h4>
              Current Graph Data <small>(editable)</small>
            </h4>
            <p>TODO - collapse this by default, and place elsewhere</p>
            <div className="json-data-container">
              <JsonTree
                data={this.state.data}
                beforeRemoveAction={this.onBeforeRemoveGraphData}
                onFullyUpdate={this.onGraphDataUpdate}
              />
            </div>
          </div>*/}

          {this.buildNodeMenu()}
        </div>
        </div>
      );
    }
  }
}

class JSONContainer extends React.Component {
  // shouldComponentUpdate(nextProps) {
  //   return !this.props.staticData && !reactD3GraphUtils.isDeepEqual(nextProps.data, this.props.data);
  // }

  render() {
    return <pre className="json-data-container">{JSON.stringify(this.props.data, null, 2)}</pre>;
  }
}
