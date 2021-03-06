import * as d3 from 'https://cdn.skypack.dev/d3@7';

import {ForceGraph} from './disjunctgraph.mjs';

const makeChart = (data) => ForceGraph(data, {
  nodeId: d => d.id,
  nodeGroup: d => d.group,
  nodeGroups: [
            'manuscript',
            'author, editor, translator',
            'scribe, proofreader, annotator',
            'commissioner, owner, collector',
            'other'
            ],
  nodeTitle: d => `${d.id} (${d.roles})`,
  linkStrokeWidth: l => Math.sqrt(l.value),
  width: window.innerWidth,
  height: window.innerHeight,
  invalidation: null // a promise to stop the simulation when the cell is re-run
});

const toolTip = {
    make: function(e,targ) {
        const toolText = targ.querySelector('desc').innerHTML;
        if(!toolText) return;

        var tBox = document.getElementById('tooltip');
        const tBoxDiv = document.createElement('div');

        if(tBox) {
            for(const kid of tBox.childNodes) {
                if(kid.myTarget === targ)
                    return;
            }
            tBoxDiv.appendChild(document.createElement('hr'));
        }
        else {
            tBox = document.createElement('div');
            tBox.id = 'tooltip';
            tBox.style.top = (e.clientY + 10) + 'px';
            tBox.style.left = e.clientX + 'px';
            tBox.style.opacity = 0;
            tBox.style.transition = 'opacity 0.2s ease-in';
            document.body.appendChild(tBox);
            tBoxDiv.myTarget = targ;
        }

        tBoxDiv.appendChild(document.createTextNode(toolText));
        tBoxDiv.myTarget = targ;
        tBox.appendChild(tBoxDiv);
        targ.addEventListener('mouseleave',toolTip.remove,{once: true});
        window.getComputedStyle(tBox).opacity;
        tBox.style.opacity = 1;
    },
    remove: function(e) {
        const tBox = document.getElementById('tooltip');
        if(tBox.children.length === 1) {
            tBox.remove();
            return;
        }

        const targ = e.target;
        for(const kid of tBox.childNodes) {
            if(kid.myTarget === targ) {
                kid.remove();
                break;
            }
        }
        if(tBox.children.length === 1) {
            const kid = tBox.firstChild.firstChild;
            if(kid.tagName === 'HR')
                kid.remove();
        }
    },
};

const chartMouseover = (e) => {
    const targ = e.target.closest('circle');
    if(targ)
        toolTip.make(e,targ);
};

const makeLegend = (color) => {
    const categories = color.domain();
    const colors = color.range();
    const legend = categories.map((x, i) => {
        const rect = document.createElement('div');
        rect.classList.add('legend-square');
        rect.style.background = colors[i];
        const txt = document.createElement('div');
        txt.appendChild(document.createTextNode(x));
        txt.classList.add('legend-label');
        const container = document.createElement('div');
        container.classList.add('legend-item');
        container.appendChild(rect);
        container.appendChild(txt);
        return container;
    });
    
    const ret = legend.reduce((acc,cur) => {
        acc.appendChild(cur);
        return acc;
    },document.createElement('div'));
    ret.id = 'legend';
    return ret;
};

export { makeChart, makeLegend, chartMouseover };
