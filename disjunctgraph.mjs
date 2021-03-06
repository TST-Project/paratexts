import * as d3 from 'https://cdn.skypack.dev/d3@7';
import d3SvgLegend from 'https://cdn.skypack.dev/d3-svg-legend';

// Copyright 2021 Observable, Inc.
// Released under the ISC license.
// https://observablehq.com/@d3/disjoint-force-directed-graph
const ForceGraph = function({
  nodes, // an iterable of node objects (typically [{id}, …])
  links // an iterable of link objects (typically [{source, target}, …])
}, {
  nodeId = d => d.id, // given d in nodes, returns a unique identifier (string)
  nodeGroup, // given d in nodes, returns an (ordinal) value for color
  nodeGroups, // an array of ordinal values representing the node groups
  nodeTitle, // given d in nodes, a title string
  nodeFill = "currentColor", // node stroke fill (if not using a group color encoding)
  nodeStroke = "#fff", // node stroke color
  nodeStrokeWidth = 1.5, // node stroke width, in pixels
  nodeStrokeOpacity = 1, // node stroke opacity
  nodeRadius = 7, // node radius, in pixels
  nodeSize = d => {return d.size ? 7 + d.size * 0.2 : 5},
  nodeStrength,
  linkSource = ({source}) => source, // given d in links, returns a node identifier string
  linkTarget = ({target}) => target, // given d in links, returns a node identifier string
  linkStroke = "#999", // link stroke color
  linkStrokeOpacity = 0.6, // link stroke opacity
  linkStrokeWidth = 1.5, // given d in links, returns a stroke width in pixels
  linkStrokeLinecap = "round", // link stroke linecap
  linkStrength,
  colors = [...d3.schemeTableau10,...d3.schemeCategory10], // an array of color strings, for the node groups
  width = 640, // outer width, in pixels
  height = 400, // outer height, in pixels
  invalidation // when this promise resolves, stop the simulation
} = {}) {
  // Compute values.
  const N = d3.map(nodes, nodeId).map(intern);
  const LS = d3.map(links, linkSource).map(intern);
  const LT = d3.map(links, linkTarget).map(intern);
  if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
  const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
  const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
  const Gs = nodeGroup == null ? null : d3.map(nodes, (i) => i.groups).map(intern);
  const R = d3.map(nodes, nodeSize).map(intern);
  const W = typeof linkStrokeWidth !== "function" ? null : d3.map(links, linkStrokeWidth);

  // Replace the input nodes and links with mutable objects for the simulation.
  nodes = d3.map(nodes, (_, i) => ({id: N[i]}));
  links = d3.map(links, (_, i) => ({source: LS[i], target: LT[i]}));

  // Compute default domains.
  if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);
  // Construct the scales.
  nodeGroups = [...new Set(nodeGroups)].filter(x => x); // ignore groupless nodes
  const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);
  // Construct the forces.
  const forceNode = d3.forceManyBody();
  const forceLink = d3.forceLink(links).id(({index: i}) => N[i]);
  if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
  else forceNode.strength(function(d,i) {
      const a = i === 0 ? -1200 : -1000;
      return a;
  }).distanceMin(70).distanceMax(170);
  if (linkStrength !== undefined) forceLink.strength(linkStrength);

  const simulation = d3.forceSimulation(nodes)
      .force("link", forceLink)
      .force("charge", forceNode)
      .force("x", d3.forceX())
      .force("y", d3.forceY())
      .on("tick", ticked);

  const svg = d3.create("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

  const link = svg.append("g")
      .attr("stroke", linkStroke)
      .attr("stroke-opacity", linkStrokeOpacity)
      .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
      .attr("stroke-linecap", linkStrokeLinecap)
    .selectAll("line")
    .data(links)
    .join("line");

  if (W) link.attr("stroke-width", ({index: i}) => W[i]);

  const node = svg.append("g")
      .attr("fill", nodeFill)
      .attr("stroke", nodeStroke)
      .attr("stroke-opacity", nodeStrokeOpacity)
      .attr("stroke-width", nodeStrokeWidth)
    .selectAll("circle")
    .data(nodes)
    .join("circle")
      .attr("r", ({index: i}) => R[i])
      .call(drag(simulation));
   
  const gradients = new Map();
  const makeGradient = (name,groups) => {
    const colors = groups.map(g => color(g));
    const step = Math.min(100/colors.length);
    const stops = colors.map((c,i) => {
        return [{color: c, stop: step * i},{color: c, stop: step * (i+1)}];
    }).flat();
    return {name: groups.join('_').replace(/\s/g,'_'),
            colors: stops
            };
  };

  if (G) node.attr("fill", ({index: i}) => {
      const group = G[i];
      if(!group) {
          const groups = Gs[i];
          if(!groups) return '#000';
          
          const name = groups.join('_').replace(/\s/g,'_');
          if(!gradients.has(name))
            gradients.set(name,makeGradient(name,groups));
          return `url(#${name})`;
      }
      else return color(group);
    });
  //if (T) node.append("title").text(({index: i}) => T[i]);
  if (T) node.append("desc").text(({index: i}) => T[i]);
  /*
  if (T) node.append("desc").text(({index: i}) => {
      const group = G[i] || Gs[i].join(', ');
      return `${N[i]} (${group})`;
      });
  */
  const defs = svg.append("defs");
  for(const [name,gradient] of gradients) {
    const el = defs.append("linearGradient").attr("id",name);
    for(const color of gradient.colors) {
        el.append("stop").attr("offset",`${color.stop}%`).attr("stop-color",color.color);
    }
  }

  // Handle invalidation.
  if (invalidation != null) invalidation.then(() => simulation.stop());

  function intern(value) {
    return value !== null && typeof value === "object" ? value.valueOf() : value;
  }

  function ticked() {
    link
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y);

    node
      .attr("cx", d => d.x)
      .attr("cy", d => d.y);
  }

  function drag(simulation) {    
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
  }
  /*
  const legend = d3SvgLegend.legendColor().scale(color).orient('horizontal').shape('circle').shapePadding(300);
  svg.append('g').attr('class','legendOrdinal').attr('transform','translate(-750,470)');
  svg.select('.legendOrdinal').call(legend);
  */
  return Object.assign(svg.node(), {scales: {color}});
};

export { ForceGraph };
