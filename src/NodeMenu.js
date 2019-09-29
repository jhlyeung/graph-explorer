import React from "react";

export class NodeMenu extends React.Component {
  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
    this.handleShowReferencesClick = this.handleShowReferencesClick.bind(this);
  }

  selectedNodeConnectedTypes() {
    const { 
      connectedTypesByNode, 
      selectedNode
    } = this.props;

    return connectedTypesByNode[selectedNode.id];
  }

  handleChange(e) {
    const direction = e.target.id.split(":")[0];
    const connectedTypeLabel = e.target.id.split(":")[1];
    const checked = e.target.checked;

    // pass the selected node and link label
    const nodeLabel = connectedTypeLabel.split("-")[0];
    const linkLabel = connectedTypeLabel.split("-")[1];

    this.props.handleSelectedNodeTypeChange(this.props.selectedNode.id, direction, linkLabel, nodeLabel, checked);
  }

  handleShowReferencesClick() {
    this.props.handleDemoShowReferences({ Experiment: true, TastingNote: true }); 
  }

  buildConnectedType(direction, label, connectedTypeData) {
    const checkedState = connectedTypeData.selected;
    const elId = direction + ":" + label;

    return(
      <div key={elId}>
        <input 
          className="form-check-input" 
          type="checkbox"
          id={elId}
          onChange={this.handleChange}
          checked={checkedState} />
        <label className="form-check-label" htmlFor={label}>
          { label }
        </label>
      </div>
    );
  }

  buildConnectedNodeTypes(direction) {
    const { nodeLabels, linkLabels } = this.selectedNodeConnectedTypes()[direction];

    let nodeOptions = <div></div>;
    if (nodeLabels) {
      nodeOptions = Object.keys(nodeLabels).map(nodeLabel => {
        const nodeTypeData = nodeLabels[nodeLabel];
        return this.buildConnectedType(direction, nodeLabel, nodeTypeData);
      });
    }

    let linkOptions = <div></div>;
    if (linkLabels) {
      linkOptions = Object.keys(linkLabels).map(linkLabel => {
        const linkTypeData = linkLabels[linkLabel];
        const label = `${linkTypeData.connectedNodeType}-${linkLabel}`

        return this.buildConnectedType(direction, label, linkTypeData);
      });
    }

    return(
      <div>
        { nodeOptions }
        { linkOptions }
      </div> 
    );
  }

  render() {
    const {
      children,
      className,
      coords,
      connectedTypesByNode
    } = this.props;


    // const { value } = this.state;

    // let containerClassName = "dropdown-form " + className;
    const incomingNodeComponents = this.buildConnectedNodeTypes("incoming");
    const outgoingNodeComponents = this.buildConnectedNodeTypes("outgoing");

    return (
      <div style={{
        left: coords.x,
        top: coords.y,
        width: "300px", 
        border: "1px solid black", 
        position: "absolute",
        zIndex: 1,
        backgroundColor: "white",
        padding: "1em"
      }}>
        <h6>Actions</h6>
        
        <div className="contextmenu-action text-center" onClick={this.handleShowReferencesClick}>
          <div className="contextmenu-action-icon pl-3 pr-3">
            <img src="https://i.pinimg.com/originals/28/1d/3e/281d3e70c4e0d116d9df114505f2a249.png" />
          </div>
          <div></div>
          References
        </div>

        <div>
          <strong><p>Incoming Connections</p></strong>
          <div className="form-check">
            {incomingNodeComponents}
          </div>

          <strong><p>Outgoing Connections</p></strong>
          <div className="form-check">
            {outgoingNodeComponents}
          </div>
        </div>
      </div>
    );
  }
}
