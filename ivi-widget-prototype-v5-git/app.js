(() => {
  const CAPACITY = 3;

  const OPTIONS = {
    A: {
      name: 'A. Free Placement',
      short: 'Free Placement',
      description: 'True free placement inside each 3-row page. Cards may stay in top, middle, or bottom slots; a drop can shove/reorder other cards inside that page. No cross-page overflow.'
    },
    B: {
      name: 'B. Global Auto-compaction',
      short: 'Global Auto-compaction',
      description: 'All widgets share one global order. Add, delete, or move changes that order, then every page is repaginated from the front.'
    },
    C: {
      name: 'C. Page-local + Spill',
      short: 'Page-local + Spill',
      description: 'Default (toggle OFF): free placement inside the edited page, with overflow sent to a new spill page. Toggle ON only changes existing cross-page moves to bounded source-target reflow with no new spill page.'
    }
  };

  const SCENARIOS = {
    1: {
      title: 'Full P1 + add 1x2',
      description: 'Five pages are already configured. Add X(1x2) after A in the full first page.',
      pages: [
        [['A',1],['B',1],['C',1]],
        [['D',2],['E',1]],
        [['F',1],['G',2]],
        [['H',2],['I',1]],
        [['J',1],['K',1],['L',1]]
      ],
      action: { type:'add', size:2, id:'X', page:0, after:'A' }
    },
    2: {
      title: 'Cross-page move into a full target',
      description: 'Move I(1x1) from P4 into the full P1, between A and B.',
      pages: [
        [['A',1],['B',1],['C',1]],
        [['D',2],['E',1]],
        [['F',1],['G',2]],
        [['H',1],['I',1],['J',1]],
        [['K',2],['L',1]]
      ],
      action: { type:'move', id:'I', page:0, after:'A' }
    },
    3: {
      title: 'One empty row + add 1x2 between cards',
      description: 'P1 visibly has one empty row, but inserting a 1x2 between A and B needs four total rows.',
      pages: [
        [['A',1],['B',1]],
        [['C',2],['D',1]],
        [['E',1],['F',2]],
        [['G',1],['H',1]],
        [['I',2],['J',1]]
      ],
      action: { type:'add', size:2, id:'X', page:0, after:'A' }
    },
    4: {
      title: 'Delete a front-page 1x2',
      description: 'Delete A(1x2) from the first page and compare how far the resulting pull/reflow propagates.',
      pages: [
        [['A',2],['B',1]],
        [['C',1],['D',1],['E',1]],
        [['F',2],['G',1]],
        [['H',1],['I',2]],
        [['J',1],['K',1],['L',1]]
      ],
      action: { type:'delete', id:'A' }
    }
  };

  const BASE_COLORS = [
    ['#d7e4f5','#bfcfe3'], ['#f1d8d4','#ddb9b4'], ['#dce8d2','#bfd1b1'],
    ['#d9d3e8','#bfb6d8'], ['#e7dfcf','#d1c3a9'], ['#cfe2e1','#b4d1cf'],
    ['#e4d4df','#d0b8c7'], ['#d6dde8','#bec8d7'], ['#e8dacb','#d4c0aa'],
    ['#d2e0d7','#bad0c2'], ['#d9d8eb','#c0bfdc'], ['#e7d8d0','#d3bdb2']
  ];

  const app = {
    option: 'C',
    scenario: 1,
    states: {},
    histories: {},
    selectedPageId: {},
    newCounter: 1,
    drag: null,
    preview: null,
    lastHoverKey: null,
    deleteTimer: null,
    cExistingMoveBounded: false,
    edgeDwellTimer: null,
    edgeDwellDirection: null,
    lastPointer: null
  };

  const els = {
    optionTabs: document.getElementById('optionTabs'),
    scenarioTabs: document.getElementById('scenarioTabs'),
    cMoveMode: document.getElementById('cMoveMode'),
    cMovePushToggle: document.getElementById('cMovePushToggle'),
    scenarioNumber: document.getElementById('scenarioNumber'),
    scenarioTitle: document.getElementById('scenarioTitle'),
    scenarioDescription: document.getElementById('scenarioDescription'),
    ruleName: document.getElementById('ruleName'),
    ruleDescription: document.getElementById('ruleDescription'),
    statusBar: document.getElementById('statusBar'),
    mainRail: document.getElementById('mainRail'),
    pageOverview: document.getElementById('pageOverview'),
    currentPageLabel: document.getElementById('currentPageLabel'),
    pageDots: document.getElementById('pageDots'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    prevDragPageZone: document.getElementById('prevDragPageZone'),
    nextDragPageZone: document.getElementById('nextDragPageZone'),
    addPageBtn: document.getElementById('addPageBtn'),
    deletePageBtn: document.getElementById('deletePageBtn'),
    undoBtn: document.getElementById('undoBtn'),
    resetBtn: document.getElementById('resetBtn'),
    doneBtn: document.getElementById('doneBtn'),
    runScenarioBtn: document.getElementById('runScenarioBtn'),
    palette1: document.getElementById('palette1'),
    palette2: document.getElementById('palette2'),
    dragGhost: document.getElementById('dragGhost')
  };

  function key(option = app.option, scenario = app.scenario) { return `${option}-${scenario}`; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function makePageId(prefix='p') { return `${prefix}-${Math.random().toString(36).slice(2,8)}`; }
  function pageUsed(items, widgets) { return items.reduce((n,id) => n + (widgets[id]?.size || 0), 0); }

  function newGradient(index) {
    const hue = (18 + (index - 1) * 34) % 360;
    const hue2 = (hue + 28) % 360;
    return [`hsl(${hue} 78% 70%)`, `hsl(${hue2} 76% 62%)`];
  }

  function baseGradient(index) {
    return BASE_COLORS[index % BASE_COLORS.length];
  }

  function widgetBackground(widget) {
    const colors = widget.colors || ['#d6dde8','#bcc8d8'];
    return `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`;
  }

  function buildWidgets(sc) {
    const widgets = {};
    let i = 0;
    sc.pages.flat().forEach(([id,size]) => {
      widgets[id] = { id, label:id, size, colors:baseGradient(i++), isNew:false };
    });
    return widgets;
  }

  function packGlobal(order, widgets, oldPages=[]) {
    const pageOrders = [];
    let current = [];
    let used = 0;
    for (const id of order) {
      const size = widgets[id]?.size || 1;
      if (current.length && used + size > CAPACITY) {
        pageOrders.push(current);
        current = [];
        used = 0;
      }
      current.push(id);
      used += size;
    }
    if (current.length || !pageOrders.length) pageOrders.push(current);
    return pageOrders.map((items,i) => ({
      id: oldPages[i]?.id || makePageId(`b${i+1}`),
      items,
      spill:false
    }));
  }

  function sequentialPlacements(items, widgets) {
    let row = 0;
    return items.map(id => {
      const size = widgets[id]?.size || 1;
      const placement = { id, start:row, size };
      row += size;
      return placement;
    });
  }

  function buildInitialState(option, scenarioId) {
    const sc = SCENARIOS[scenarioId];
    const widgets = buildWidgets(sc);
    if (option === 'A') {
      return {
        option,
        widgets,
        pages: sc.pages.map((items,i) => ({
          id: makePageId(`a${i+1}`),
          spill:false,
          placements: sequentialPlacements(items.map(([id]) => id), widgets)
        }))
      };
    }
    if (option === 'B') {
      const order = sc.pages.flat().map(([id]) => id);
      return { option, widgets, order, pages:packGlobal(order, widgets) };
    }
    return {
      option,
      widgets,
      pages: sc.pages.map((items,i) => {
        const ids = items.map(([id]) => id);
        const starts = Object.fromEntries(sequentialPlacements(ids, widgets).map(p => [p.id, p.start]));
        return { id:makePageId(`c${i+1}`), spill:false, items:ids, starts };
      })
    };
  }

  function getState() {
    const k = key();
    if (!app.states[k]) app.states[k] = buildInitialState(app.option, app.scenario);
    if (!app.histories[k]) app.histories[k] = [];
    return app.states[k];
  }

  function setState(state) { app.states[key()] = state; }

  function getDisplayState() { return app.preview?.state || getState(); }

  function pageItems(state, page) {
    if (state.option === 'A') return [...page.placements].sort((a,b)=>a.start-b.start).map(p=>p.id);
    return page.items || [];
  }

  function pagePlacements(state, page) {
    if (state.option === 'A') return [...page.placements].sort((a,b)=>a.start-b.start);
    if (state.option === 'C' && page.starts) {
      const fallback = Object.fromEntries(sequentialPlacements(page.items || [], state.widgets).map(p => [p.id, p.start]));
      return (page.items || []).map(id => ({
        id,
        start: Number.isFinite(page.starts[id]) ? page.starts[id] : fallback[id],
        size: state.widgets[id]?.size || 1
      })).sort((a,b)=>a.start-b.start);
    }
    return sequentialPlacements(page.items || [], state.widgets);
  }

  function selectedPageId() {
    const k = key();
    const state = getDisplayState();
    const current = app.selectedPageId[k];
    if (state.pages.some(p=>p.id===current)) return current;
    const first = state.pages[0]?.id || null;
    app.selectedPageId[k] = first;
    return first;
  }

  function setSelectedPage(id) { app.selectedPageId[key()] = id; render(); }

  function findWidget(state, id) {
    if (!state.widgets[id]) return null;
    if (state.option === 'A') {
      for (let pi=0; pi<state.pages.length; pi++) {
        const idx = state.pages[pi].placements.findIndex(p=>p.id===id);
        if (idx >= 0) return { pageIndex:pi, pageId:state.pages[pi].id, localIndex:idx };
      }
      return null;
    }
    for (let pi=0; pi<state.pages.length; pi++) {
      const idx = (state.pages[pi].items || []).indexOf(id);
      if (idx >= 0) return { pageIndex:pi, pageId:state.pages[pi].id, localIndex:idx };
    }
    return null;
  }

  function getGlobalPageStart(state, pageId) {
    let count = 0;
    for (const page of state.pages) {
      if (page.id === pageId) return count;
      count += page.items.length;
    }
    return count;
  }

  function placementsToStarts(placements) {
    return Object.fromEntries(placements.map(p => [p.id, p.start]));
  }

  function solveAnchoredFreePlacements(existingPlacements, widget, targetStart, widgets) {
    const others = existingPlacements
      .filter(p => p.id !== widget.id)
      .map(p => ({ id:p.id, start:p.start, size:widgets[p.id]?.size || p.size || 1 }))
      .sort((a,b) => a.start - b.start);
    const usedRows = widget.size + others.reduce((sum,p) => sum + p.size, 0);
    if (usedRows > CAPACITY) return null;

    const anchorStart = Math.max(0, Math.min(targetStart ?? 0, CAPACITY - widget.size));
    const occupied = Array(CAPACITY).fill(false);
    for (let r=anchorStart; r<anchorStart+widget.size; r++) occupied[r] = true;

    let best = null;
    function scoreAssignment(assigned) {
      let score = 0;
      for (const p of assigned) {
        const old = others.find(o => o.id === p.id);
        score += Math.abs((old?.start ?? p.start) - p.start) * 10;
      }
      for (let i=0; i<assigned.length; i++) {
        for (let j=i+1; j<assigned.length; j++) {
          const ai = others.findIndex(o => o.id === assigned[i].id);
          const aj = others.findIndex(o => o.id === assigned[j].id);
          if ((ai - aj) * (assigned[i].start - assigned[j].start) < 0) score += 4;
        }
      }
      return score;
    }

    function backtrack(index, assigned) {
      if (index >= others.length) {
        const score = scoreAssignment(assigned);
        if (!best || score < best.score) best = { score, assigned:assigned.map(x => ({...x})) };
        return;
      }
      const item = others[index];
      const candidates = [];
      for (let start=0; start<=CAPACITY-item.size; start++) {
        let free = true;
        for (let r=start; r<start+item.size; r++) if (occupied[r]) free = false;
        if (free) candidates.push(start);
      }
      candidates.sort((a,b) => Math.abs(a-item.start)-Math.abs(b-item.start) || a-b);
      for (const start of candidates) {
        for (let r=start; r<start+item.size; r++) occupied[r] = true;
        assigned.push({ id:item.id, start, size:item.size });
        backtrack(index+1, assigned);
        assigned.pop();
        for (let r=start; r<start+item.size; r++) occupied[r] = false;
      }
    }
    backtrack(0, []);
    if (!best) return null;
    return [...best.assigned, { id:widget.id, start:anchorStart, size:widget.size }].sort((a,b)=>a.start-b.start);
  }

  function cFreePlacementWithSpill(state, targetIndex, widget, insertIndex, targetStart) {
    const target = state.pages[targetIndex];
    const currentPlacements = pagePlacements(state, target).filter(p => p.id !== widget.id);
    const currentItems = target.items.filter(id => id !== widget.id);
    const safeIndex = Math.max(0, Math.min(insertIndex, currentItems.length));
    const nextItems = currentItems.slice();
    nextItems.splice(safeIndex, 0, widget.id);

    const kept = nextItems.slice();
    const spilled = [];
    const totalRows = () => kept.reduce((sum,id) => sum + (state.widgets[id]?.size || 1), 0);
    while (totalRows() > CAPACITY) {
      let removeIndex = kept.length - 1;
      while (removeIndex >= 0 && kept[removeIndex] === widget.id) removeIndex--;
      if (removeIndex < 0) break;
      spilled.unshift(kept.splice(removeIndex,1)[0]);
    }

    const keepSet = new Set(kept);
    const placementsForKept = currentPlacements.filter(p => keepSet.has(p.id));
    const solved = solveAnchoredFreePlacements(placementsForKept, widget, targetStart, state.widgets);
    if (!solved) return { ok:false, message:'C: target position cannot be resolved inside this page.' };

    target.items = solved.map(p => p.id);
    target.starts = placementsToStarts(solved);
    if (spilled.length) {
      const spillPlacements = sequentialPlacements(spilled, state.widgets);
      state.pages.splice(targetIndex + 1, 0, {
        id:makePageId('spill'),
        items:spilled,
        starts:placementsToStarts(spillPlacements),
        spill:true
      });
    }
    return { ok:true, spilled };
  }

  function packPrefix(items, widgets) {
    const kept = [];
    let used = 0;
    let index = 0;
    for (; index < items.length; index++) {
      const id = items[index];
      const size = widgets[id]?.size || 1;
      if (used + size > CAPACITY) break;
      kept.push(id);
      used += size;
    }
    return { kept, spill:items.slice(index) };
  }

  function solveStablePagePlacements(items, widgets, preferredStarts={}) {
    const fallback = Object.fromEntries(sequentialPlacements(items, widgets).map(p => [p.id, p.start]));
    const occupied = Array(CAPACITY).fill(false);
    let best = null;

    function scoreAssignment(assigned) {
      let score = 0;
      for (const p of assigned) {
        const pref = Number.isFinite(preferredStarts[p.id]) ? preferredStarts[p.id] : fallback[p.id];
        score += Math.abs(pref - p.start) * 10;
      }
      for (let i=0; i<assigned.length; i++) {
        for (let j=i+1; j<assigned.length; j++) {
          const oi = items.indexOf(assigned[i].id);
          const oj = items.indexOf(assigned[j].id);
          if ((oi - oj) * (assigned[i].start - assigned[j].start) < 0) score += 5;
        }
      }
      return score;
    }

    function backtrack(index, assigned) {
      if (index >= items.length) {
        const score = scoreAssignment(assigned);
        if (!best || score < best.score) best = { score, assigned:assigned.map(x => ({...x})) };
        return;
      }
      const id = items[index];
      const size = widgets[id]?.size || 1;
      const pref = Number.isFinite(preferredStarts[id]) ? preferredStarts[id] : fallback[id];
      const candidates = [];
      for (let start=0; start<=CAPACITY-size; start++) {
        let free = true;
        for (let r=start; r<start+size; r++) if (occupied[r]) free = false;
        if (free) candidates.push(start);
      }
      candidates.sort((a,b) => Math.abs(a-pref)-Math.abs(b-pref) || a-b);
      for (const start of candidates) {
        for (let r=start; r<start+size; r++) occupied[r] = true;
        assigned.push({ id, start, size });
        backtrack(index+1, assigned);
        assigned.pop();
        for (let r=start; r<start+size; r++) occupied[r] = false;
      }
    }

    backtrack(0, []);
    return best ? best.assigned.sort((a,b)=>a.start-b.start) : null;
  }

  function chooseBoundedEject(items, widgets, overflowRows, direction, protectedId) {
    const candidates = items.filter(id => id !== protectedId);
    if (!candidates.length) return [];
    let best = null;
    const count = candidates.length;
    for (let mask=1; mask<(1<<count); mask++) {
      const picked = [];
      let rows = 0;
      let edgePenalty = 0;
      for (let i=0; i<count; i++) {
        if (!(mask & (1<<i))) continue;
        const id = candidates[i];
        picked.push(id);
        rows += widgets[id]?.size || 1;
        const actualIndex = items.indexOf(id);
        const distanceFromEdge = direction === 'forward'
          ? (items.length - 1 - actualIndex)
          : actualIndex;
        edgePenalty += distanceFromEdge;
      }
      if (rows < overflowRows) continue;
      const cost = rows * 100 + edgePenalty * 4 + picked.length;
      if (!best || cost < best.cost) best = { cost, picked };
    }
    return best?.picked || [];
  }

  function reflowCWithinExistingPages(state, widget, source, targetPageId, insertIndex, targetStart) {
    const targetIndex = state.pages.findIndex(p => p.id === targetPageId);
    const sourceIndex = source?.pageIndex ?? -1;
    if (targetIndex < 0 || sourceIndex < 0) return { ok:false, state, message:'Source or target page not found.' };
    if (targetIndex === sourceIndex) return null;

    const originalPlacements = new Map();
    state.pages.forEach(page => {
      originalPlacements.set(page.id, pagePlacements(state, page).map(p => ({...p})));
    });

    const sourcePage = state.pages[sourceIndex];
    sourcePage.items = sourcePage.items.filter(id => id !== widget.id);
    if (sourcePage.starts) delete sourcePage.starts[widget.id];

    const targetPage = state.pages[targetIndex];
    const targetVisual = pagePlacements(state, targetPage)
      .filter(p => p.id !== widget.id)
      .sort((a,b)=>a.start-b.start)
      .map(p => p.id);
    const safeIndex = Math.max(0, Math.min(insertIndex, targetVisual.length));
    targetVisual.splice(safeIndex, 0, widget.id);
    targetPage.items = targetVisual;

    const step = targetIndex < sourceIndex ? 1 : -1;
    const direction = step === 1 ? 'forward' : 'backward';
    let currentIndex = targetIndex;
    let carry = [];
    const touched = new Set([sourceIndex, targetIndex]);

    function currentVisual(page) {
      return pagePlacements(state, page).sort((a,b)=>a.start-b.start).map(p=>p.id);
    }

    while (true) {
      const page = state.pages[currentIndex];
      let items;
      if (currentIndex === targetIndex) {
        items = [...page.items];
      } else {
        const base = currentVisual(page).filter(id => !carry.includes(id));
        items = step === 1 ? [...carry, ...base] : [...base, ...carry];
        page.items = items;
      }

      const used = pageUsed(items, state.widgets);
      let nextCarry = [];
      if (used > CAPACITY) {
        const overflowRows = used - CAPACITY;
        const protectedId = currentIndex === targetIndex ? widget.id : null;
        const eject = chooseBoundedEject(items, state.widgets, overflowRows, direction, protectedId);
        if (!eject.length) {
          return { ok:false, state, message:'C bounded reflow could not resolve this move without creating a new page.' };
        }
        const ejectSet = new Set(eject);
        nextCarry = items.filter(id => ejectSet.has(id));
        page.items = items.filter(id => !ejectSet.has(id));
      } else {
        page.items = items;
      }

      const prior = Object.fromEntries((originalPlacements.get(page.id) || []).map(p => [p.id, p.start]));
      let solved;
      if (currentIndex === targetIndex) {
        const existing = page.items
          .filter(id => id !== widget.id)
          .map(id => ({ id, start:Number.isFinite(prior[id]) ? prior[id] : 0, size:state.widgets[id]?.size || 1 }));
        solved = solveAnchoredFreePlacements(existing, widget, targetStart, state.widgets);
      } else {
        solved = solveStablePagePlacements(page.items, state.widgets, prior);
      }
      if (!solved) {
        return { ok:false, state, message:'C bounded reflow could not fit the affected widgets inside the existing page corridor.' };
      }
      page.items = solved.map(p=>p.id);
      page.starts = placementsToStarts(solved);
      touched.add(currentIndex);

      carry = nextCarry;
      if (!carry.length) break;
      const nextIndex = currentIndex + step;
      const passedSource = step === 1 ? nextIndex > sourceIndex : nextIndex < sourceIndex;
      if (passedSource || nextIndex < 0 || nextIndex >= state.pages.length) {
        return { ok:false, state, message:'C bounded reflow reached the source-page boundary and still had overflow.' };
      }
      currentIndex = nextIndex;
    }

    // If the source gap was not needed to absorb the cascade, preserve it as the user's explicit move result.
    if (!touched.has(sourceIndex) || sourceIndex !== currentIndex) {
      const source = state.pages[sourceIndex];
      const ids = source.items || [];
      const prior = Object.fromEntries((originalPlacements.get(source.id) || []).filter(p=>p.id!==widget.id).map(p => [p.id, p.start]));
      const solved = solveStablePagePlacements(ids, state.widgets, prior);
      if (solved) {
        source.items = solved.map(p=>p.id);
        source.starts = placementsToStarts(solved);
      }
    }

    const lo = Math.min(sourceIndex, targetIndex) + 1;
    const hi = Math.max(sourceIndex, targetIndex) + 1;
    return {
      ok:true,
      state,
      message:`C exception ON: no Spill Page. Reflow stayed within P${lo}–P${hi} and stopped as soon as existing capacity absorbed the move.`
    };
  }

  function previewTransaction(baseState, drag, targetPageId, insertIndex, targetStart=null) {
    const state = clone(baseState);
    const widget = drag.widget;
    state.widgets[widget.id] = clone(widget);

    if (state.option === 'A') {
      const source = drag.type === 'existing' ? findWidget(state, widget.id) : null;
      if (source) state.pages[source.pageIndex].placements = state.pages[source.pageIndex].placements.filter(p=>p.id!==widget.id);
      const targetPage = state.pages.find(p=>p.id===targetPageId);
      if (!targetPage) return { ok:false, state:baseState, message:'Target page not found.' };
      const used = widget.size + targetPage.placements.reduce((sum,p)=>sum + (state.widgets[p.id]?.size || p.size || 1), 0);
      if (used > CAPACITY) return { ok:false, state:baseState, message:`A: target page needs ${used} rows. No cross-page overflow is allowed.` };
      const desiredStart = targetStart ?? Math.min(insertIndex, CAPACITY - widget.size);
      const solved = solveAnchoredFreePlacements(targetPage.placements, widget, desiredStart, state.widgets);
      if (!solved) return { ok:false, state:baseState, message:'A: no valid arrangement exists inside this page.' };
      targetPage.placements = solved;
      return { ok:true, state, message:`A: free placement at row ${Math.max(0, Math.min(desiredStart, CAPACITY-widget.size))+1}; neighboring cards may shove/reorder only inside this page.` };
    }

    if (state.option === 'B') {
      let globalIndex = getGlobalPageStart(baseState, targetPageId) + insertIndex;
      if (drag.type === 'existing') {
        const sourceIndex = state.order.indexOf(widget.id);
        if (sourceIndex >= 0) {
          state.order.splice(sourceIndex,1);
          if (sourceIndex < globalIndex) globalIndex -= 1;
        }
      }
      globalIndex = Math.max(0, Math.min(globalIndex, state.order.length));
      state.order.splice(globalIndex,0,widget.id);
      state.pages = packGlobal(state.order, state.widgets, state.pages);
      return { ok:true, state, message:`B: global order changed. All ${state.pages.length} pages are repaginated.` };
    }

    const cSource = drag.type === 'existing' ? findWidget(state, widget.id) : null;
    const isCrossPageExistingMove = !!(cSource && cSource.pageId !== targetPageId);
    if (drag.type === 'existing' && app.cExistingMoveBounded && isCrossPageExistingMove) {
      return reflowCWithinExistingPages(state, widget, cSource, targetPageId, insertIndex, targetStart);
    }

    if (cSource) {
      const sourcePage = state.pages[cSource.pageIndex];
      sourcePage.items = sourcePage.items.filter(id=>id!==widget.id);
      if (sourcePage.starts) delete sourcePage.starts[widget.id];
    }
    const targetIndex = state.pages.findIndex(p=>p.id===targetPageId);
    if (targetIndex < 0) return { ok:false, state:baseState, message:'Target page not found.' };
    const desiredStart = targetStart ?? Math.min(insertIndex, CAPACITY - widget.size);
    const placed = cFreePlacementWithSpill(state, targetIndex, widget, insertIndex, desiredStart);
    if (!placed.ok) return { ok:false, state:baseState, message:placed.message };
    if (placed.spilled.length) {
      return { ok:true, state, message:`C: free placement inside the target page. ${placed.spilled.join(', ')} moved to a new spill page; later pages stay grouped.` };
    }
    return { ok:true, state, message:`C: free placement at row ${Math.max(0, Math.min(desiredStart, CAPACITY-widget.size))+1}. Other pages stay unchanged.` };
  }

  function deleteFromState(baseState, id) {
    const state = clone(baseState);
    const found = findWidget(state,id);
    if (!found) return {ok:false,state:baseState,message:'Widget not found.'};
    if (state.option === 'A') {
      state.pages[found.pageIndex].placements = state.pages[found.pageIndex].placements.filter(p=>p.id!==id);
    } else if (state.option === 'B') {
      state.order = state.order.filter(x=>x!==id);
      state.pages = packGlobal(state.order, state.widgets, state.pages);
    } else {
      const page = state.pages[found.pageIndex];
      page.items = page.items.filter(x=>x!==id);
      if (page.starts) delete page.starts[id];
    }
    delete state.widgets[id];
    const messages = {
      A: 'A: only that slot becomes empty. Other pages do not move.',
      B: `B: the global order pulls forward and repaginates ${state.pages.length} pages.`,
      C: 'C: only that page reflows upward. No widget is pulled from another page.'
    };
    return {ok:true,state,message:messages[state.option]};
  }

  function snapshotCurrent() {
    const hist = app.histories[key()] || (app.histories[key()] = []);
    hist.push(clone(getState()));
    if (hist.length > 40) hist.shift();
  }

  function setStatus(message, type='neutral') {
    els.statusBar.textContent = message;
    els.statusBar.className = `status ${type}`;
  }

  function captureRects() {
    const map = new Map();
    document.querySelectorAll('[data-anim-key]').forEach(el => {
      if (!el.classList.contains('removing')) map.set(el.dataset.animKey, el.getBoundingClientRect());
    });
    return map;
  }

  function animateFromRects(oldRects) {
    requestAnimationFrame(() => {
      document.querySelectorAll('[data-anim-key]').forEach(el => {
        const old = oldRects.get(el.dataset.animKey);
        if (!old) {
          el.animate([
            { opacity:0, transform:'scale(.9)' },
            { opacity:1, transform:'scale(1)' }
          ], { duration:220, easing:'cubic-bezier(.2,.8,.2,1)' });
          return;
        }
        const next = el.getBoundingClientRect();
        const dx = old.left - next.left;
        const dy = old.top - next.top;
        const sx = old.width && next.width ? old.width / next.width : 1;
        const sy = old.height && next.height ? old.height / next.height : 1;
        if (Math.abs(dx) > .5 || Math.abs(dy) > .5 || Math.abs(sx-1) > .01 || Math.abs(sy-1) > .01) {
          el.animate([
            { transform:`translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
            { transform:'translate(0,0) scale(1,1)' }
          ], { duration:260, easing:'cubic-bezier(.2,.8,.2,1)' });
        }
      });
    });
  }

  function renderAnimated(oldRects = null) {
    const rects = oldRects || captureRects();
    render();
    animateFromRects(rects);
  }

  function commitPreview(preview) {
    if (!preview?.ok) return;
    clearEdgeDwell();
    const oldRects = captureRects();
    snapshotCurrent();
    setState(preview.state);
    app.preview = null;
    if (app.drag?.type === 'new') app.newCounter += 1;
    const targetId = app.drag?.targetPageId;
    if (targetId) app.selectedPageId[key()] = targetId;
    setStatus(preview.message, 'success');
    app.drag = null;
    app.lastHoverKey = null;
    hideGhost();
    render();
    animateFromRects(oldRects);
  }

  function startDragFromPalette(size, ev) {
    if (ev.button !== 0) return;
    ev.preventDefault();
    const idx = app.newCounter;
    const id = `N${idx}`;
    const colors = newGradient(idx);
    const widget = { id, label:id, size, colors, isNew:true };
    beginDrag({ type:'new', widget }, ev);
  }

  function startDragExisting(id, ev) {
    if (ev.button !== 0 || ev.target.closest('.widget-delete')) return;
    ev.preventDefault();
    const state = getState();
    const widget = state.widgets[id];
    if (!widget) return;
    beginDrag({ type:'existing', widget:clone(widget) }, ev);
  }

  function beginDrag(dragInfo, ev) {
    app.preview = null;
    app.lastHoverKey = null;
    app.drag = {
      ...dragInfo,
      baseState: clone(getState()),
      pointerId: ev.pointerId,
      targetPageId: null,
      insertIndex: null,
      markerRatio: .5,
      valid:false
    };
    showGhost(dragInfo.widget, ev.clientX, ev.clientY);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    setStatus('Dragging: hover over a widget page to preview the final result.', 'preview');
    render();
  }

  function showGhost(widget, x, y) {
    els.dragGhost.className = `drag-ghost size-${widget.size}`;
    els.dragGhost.style.background = widgetBackground(widget);
    els.dragGhost.innerHTML = `<strong>${widget.label}</strong><span>${widget.size===2?'1x2 / 2 rows':'1x1 / 1 row'}</span>`;
    moveGhost(x,y);
  }

  function moveGhost(x,y) {
    els.dragGhost.style.left = `${x}px`;
    els.dragGhost.style.top = `${y}px`;
  }

  function hideGhost() { els.dragGhost.classList.add('hidden'); }

  function pageLayoutForHitTest(baseState, pageId, draggedId) {
    const state = clone(baseState);
    if (draggedId && state.widgets[draggedId]) {
      const found = findWidget(state,draggedId);
      if (found) {
        if (state.option === 'A') state.pages[found.pageIndex].placements = state.pages[found.pageIndex].placements.filter(p=>p.id!==draggedId);
        else if (state.option === 'C') state.pages[found.pageIndex].items = state.pages[found.pageIndex].items.filter(id=>id!==draggedId);
      }
    }
    const page = state.pages.find(p=>p.id===pageId);
    if (!page) return [];
    if (state.option === 'B') return pagePlacements(baseState, baseState.pages.find(p=>p.id===pageId));
    return pagePlacements(state,page);
  }

  function insertionIndexFromPointer(baseState, pageId, surface, clientY, draggedId) {
    const rect = surface.getBoundingClientRect();
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    const layout = pageLayoutForHitTest(baseState,pageId,draggedId);
    const rowScale = rect.height / CAPACITY;
    const dragSize = app.drag?.widget?.size || 1;
    const startRow = Math.max(0, Math.min(Math.floor(y / rowScale), CAPACITY - dragSize));
    if (!layout.length) return { index:0, ratio:y/rect.height, startRow };
    for (let i=0; i<layout.length; i++) {
      const mid = (layout[i].start + layout[i].size/2) * rowScale;
      if (y < mid) return { index:i, ratio:y/rect.height, startRow };
    }
    return { index:layout.length, ratio:y/rect.height, startRow };
  }

  function clearEdgeDwell(removeVisual=true) {
    if (app.edgeDwellTimer) clearTimeout(app.edgeDwellTimer);
    app.edgeDwellTimer = null;
    app.edgeDwellDirection = null;
    if (removeVisual) {
      els.prevDragPageZone.classList.remove('dwelling');
      els.nextDragPageZone.classList.remove('dwelling');
    }
  }

  function edgeCanNavigate(direction) {
    const state = app.drag?.baseState || getState();
    const currentId = app.selectedPageId[key()] || state.pages[0]?.id;
    const idx = state.pages.findIndex(p => p.id === currentId);
    if (idx < 0) return false;
    return direction === 'prev' ? idx > 0 : idx < state.pages.length - 1;
  }

  function renderDragPageZones(state, pageIndex) {
    const show = app.drag?.type === 'new';
    [els.prevDragPageZone, els.nextDragPageZone].forEach(zone => zone.classList.toggle('shown', !!show));
    els.prevDragPageZone.classList.toggle('unavailable', !show || pageIndex <= 0);
    els.nextDragPageZone.classList.toggle('unavailable', !show || pageIndex >= state.pages.length - 1);
    els.prevDragPageZone.setAttribute('aria-hidden', show ? 'false' : 'true');
    els.nextDragPageZone.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function startEdgeDwell(direction) {
    if (!app.drag || app.drag.type !== 'new') return;
    if (app.edgeDwellDirection === direction && app.edgeDwellTimer) return;
    clearEdgeDwell();

    if (!edgeCanNavigate(direction)) {
      setStatus(direction === 'prev' ? 'This is the first page.' : 'This is the last page. Use + to create a new page after it.', 'preview');
      return;
    }

    if (app.preview) {
      const oldRects = captureRects();
      app.preview = null;
      app.drag.targetPageId = null;
      app.drag.valid = false;
      app.lastHoverKey = null;
      render();
      animateFromRects(oldRects);
    }

    app.edgeDwellDirection = direction;
    const zone = direction === 'prev' ? els.prevDragPageZone : els.nextDragPageZone;
    zone.classList.add('dwelling');
    setStatus(`Hold here for 1 second to open the ${direction === 'prev' ? 'previous' : 'next'} page.`, 'preview');

    app.edgeDwellTimer = setTimeout(() => {
      app.edgeDwellTimer = null;
      zone.classList.remove('dwelling');
      if (!app.drag || app.drag.type !== 'new' || app.edgeDwellDirection !== direction) return;

      const state = app.drag.baseState;
      const currentId = app.selectedPageId[key()] || state.pages[0]?.id;
      const idx = state.pages.findIndex(p => p.id === currentId);
      const nextIndex = direction === 'prev' ? idx - 1 : idx + 1;
      if (nextIndex < 0 || nextIndex >= state.pages.length) {
        clearEdgeDwell();
        return;
      }

      app.selectedPageId[key()] = state.pages[nextIndex].id;
      app.preview = null;
      app.drag.targetPageId = null;
      app.drag.valid = false;
      app.lastHoverKey = null;
      render();
      setStatus(`Opened P${nextIndex + 1}. Move into the page to choose a drop position, or keep holding the edge to continue browsing.`, 'preview');

      requestAnimationFrame(() => {
        if (!app.drag || !app.lastPointer) return;
        const el = document.elementFromPoint(app.lastPointer.x, app.lastPointer.y);
        const edge = el?.closest?.('.drag-page-zone')?.dataset.edge;
        if (edge === direction && edgeCanNavigate(direction)) startEdgeDwell(direction);
        else clearEdgeDwell();
      });
    }, 1000);
  }

  function onPointerMove(ev) {
    if (!app.drag) return;
    app.lastPointer = { x:ev.clientX, y:ev.clientY };
    moveGhost(ev.clientX, ev.clientY);
    const element = document.elementFromPoint(ev.clientX, ev.clientY);
    const edgeZone = app.drag.type === 'new' ? element?.closest?.('.drag-page-zone') : null;
    if (edgeZone?.dataset.edge) {
      startEdgeDwell(edgeZone.dataset.edge);
      return;
    }
    clearEdgeDwell();
    const surface = element?.closest?.('.page-surface');
    if (!surface || !surface.dataset.pageId) {
      if (app.preview) {
        const oldRects = captureRects();
        app.preview = null;
        app.drag.targetPageId = null;
        app.drag.valid = false;
        app.lastHoverKey = null;
        render();
        animateFromRects(oldRects);
        setStatus('Outside a page: release here to cancel. Layout restored.', 'preview');
      }
      return;
    }

    const pageId = surface.dataset.pageId;
    const hit = insertionIndexFromPointer(app.drag.baseState, pageId, surface, ev.clientY, app.drag.type==='existing' ? app.drag.widget.id : null);
    const hoverKey = `${pageId}:${hit.index}:${hit.startRow}`;
    app.drag.markerRatio = hit.ratio;
    if (hoverKey === app.lastHoverKey) return;
    app.lastHoverKey = hoverKey;

    const preview = previewTransaction(app.drag.baseState, app.drag, pageId, hit.index, hit.startRow);
    app.drag.targetPageId = pageId;
    app.drag.insertIndex = hit.index;
    app.drag.targetStart = hit.startRow;
    app.drag.valid = preview.ok;
    app.preview = preview.ok ? preview : null;
    const oldRects = captureRects();
    render();
    animateFromRects(oldRects);
    setStatus(preview.message, preview.ok ? 'preview' : 'error');
  }

  function finishDrag(commit) {
    clearEdgeDwell();
    app.lastPointer = null;
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerCancel, true);
    if (commit && app.preview?.ok && app.drag?.valid) {
      commitPreview(app.preview);
      return;
    }
    const hadPreview = !!app.preview;
    const oldRects = captureRects();
    app.preview = null;
    app.drag = null;
    app.lastHoverKey = null;
    hideGhost();
    render();
    animateFromRects(oldRects);
    setStatus(hadPreview ? 'Drop cancelled. Previewed cards returned to their original positions.' : 'Drag cancelled.', 'neutral');
  }

  function onPointerUp() { finishDrag(true); }
  function onPointerCancel() { finishDrag(false); }

  function deleteWidget(id) {
    if (app.drag || app.deleteTimer) return;
    const nodes = [...document.querySelectorAll(`[data-widget-id="${CSS.escape(id)}"]`)];
    nodes.forEach(n=>n.classList.add('removing'));
    app.deleteTimer = setTimeout(() => {
      app.deleteTimer = null;
      const oldRects = captureRects();
      const result = deleteFromState(getState(), id);
      if (!result.ok) return;
      snapshotCurrent();
      setState(result.state);
      setStatus(result.message,'success');
      render();
      animateFromRects(oldRects);
    }, 170);
  }

  function makeEmptyPageForOption(option) {
    if (option === 'A') return { id:makePageId('manual'), spill:false, placements:[] };
    return { id:makePageId('manual'), spill:false, items:[], starts:{} };
  }

  function addPageAfterCurrent() {
    if (app.drag) finishDrag(false);
    const state = clone(getState());
    const currentId = selectedPageId();
    const currentIndex = Math.max(0, state.pages.findIndex(p => p.id === currentId));
    const newPage = makeEmptyPageForOption(state.option);
    snapshotCurrent();
    state.pages.splice(currentIndex + 1, 0, newPage);
    setState(state);
    app.selectedPageId[key()] = newPage.id;
    setStatus(`New empty page inserted as P${currentIndex + 2}, immediately after the page you were viewing.`, 'success');
    renderAnimated();
  }

  function deletePageById(pageId) {
    if (app.drag) finishDrag(false);
    const state = clone(getState());
    const pageIndex = state.pages.findIndex(p => p.id === pageId);
    if (pageIndex < 0) return;
    const page = state.pages[pageIndex];
    const ids = state.option === 'A'
      ? page.placements.map(p => p.id)
      : [...(page.items || [])];

    snapshotCurrent();
    ids.forEach(id => delete state.widgets[id]);

    if (state.option === 'B') {
      state.order = state.order.filter(id => !ids.includes(id));
      const remainingPages = state.pages.filter(p => p.id !== pageId);
      state.pages = packGlobal(state.order, state.widgets, remainingPages);
    } else {
      state.pages.splice(pageIndex, 1);
      if (!state.pages.length) state.pages.push(makeEmptyPageForOption(state.option));
    }

    setState(state);
    const nextIndex = Math.min(pageIndex, state.pages.length - 1);
    app.selectedPageId[key()] = state.pages[nextIndex].id;
    const removed = ids.length ? ` Deleted widgets: ${ids.join(', ')}.` : '';
    setStatus(`Page deleted.${removed} Undo restores the whole page transaction.`, 'success');
    renderAnimated();
  }

  function deleteCurrentPage() {
    deletePageById(selectedPageId());
  }

  function cleanupEmptyPages() {
    if (app.drag) return;
    const state = clone(getState());
    snapshotCurrent();
    if (state.option === 'A') state.pages = state.pages.filter(p=>p.placements.length);
    else if (state.option === 'C') state.pages = state.pages.filter(p=>p.items.length);
    if (state.option === 'B') state.pages = packGlobal(state.order, state.widgets, state.pages);
    if (!state.pages.length) {
      if (state.option === 'A') state.pages = [{id:makePageId('empty'),spill:false,placements:[]}];
      else state.pages = [{id:makePageId('empty'),spill:false,items:[],starts:{}}];
    }
    setState(state);
    app.selectedPageId[key()] = state.pages[0].id;
    setStatus('Done: fully empty pages removed. Empty rows inside non-empty pages remain.', 'success');
    renderAnimated();
  }

  function undo() {
    if (app.drag) return;
    const hist = app.histories[key()] || [];
    if (!hist.length) {
      setStatus('Nothing to undo.', 'error');
      return;
    }
    const oldRects = captureRects();
    setState(hist.pop());
    app.preview = null;
    const state = getState();
    if (!state.pages.some(p=>p.id===app.selectedPageId[key()])) app.selectedPageId[key()] = state.pages[0]?.id;
    setStatus('Undo: the previous layout transaction was restored.', 'success');
    render();
    animateFromRects(oldRects);
  }

  function resetCurrent() {
    if (app.drag) finishDrag(false);
    app.states[key()] = buildInitialState(app.option, app.scenario);
    app.histories[key()] = [];
    app.selectedPageId[key()] = app.states[key()].pages[0].id;
    app.newCounter = 1;
    app.preview = null;
    setStatus('Scenario reset.', 'neutral');
    render();
  }

  function findInsertIndexAfter(state, pageIndex, afterId) {
    const page = state.pages[pageIndex];
    if (!page) return 0;
    const items = pageItems(state,page);
    const idx = items.indexOf(afterId);
    return idx < 0 ? items.length : idx + 1;
  }

  function runScenarioAction() {
    resetCurrent();
    const sc = SCENARIOS[app.scenario];
    const action = sc.action;
    const state = getState();

    if (action.type === 'delete') {
      deleteWidget(action.id);
      return;
    }

    let widget;
    let dragType;
    if (action.type === 'add') {
      widget = { id:action.id, label:action.id, size:action.size, colors:newGradient(1), isNew:true };
      dragType = 'new';
    } else {
      widget = clone(state.widgets[action.id]);
      dragType = 'existing';
    }
    const targetPage = state.pages[action.page];
    const insertIndex = findInsertIndexAfter(state, action.page, action.after);
    const afterPlacement = pagePlacements(state, targetPage).find(p => p.id === action.after);
    const targetStart = afterPlacement
      ? Math.min(afterPlacement.start + afterPlacement.size, CAPACITY - widget.size)
      : 0;
    const drag = { type:dragType, widget, baseState:clone(state), targetPageId:targetPage.id };
    const result = previewTransaction(state, drag, targetPage.id, insertIndex, targetStart);
    if (!result.ok) {
      setStatus(result.message,'error');
      render();
      return;
    }
    const oldRects = captureRects();
    snapshotCurrent();
    setState(result.state);
    app.selectedPageId[key()] = targetPage.id;
    if (dragType === 'new') app.newCounter += 1;
    setStatus(result.message,'success');
    render();
    animateFromRects(oldRects);
  }

  function renderControls() {
    els.optionTabs.innerHTML = '';
    Object.entries(OPTIONS).forEach(([id,opt]) => {
      const b = document.createElement('button');
      b.className = `seg-btn ${app.option===id?'active':''}`;
      b.textContent = opt.short;
      b.onclick = () => {
        if (app.drag) finishDrag(false);
        app.option = id;
        getState();
        app.selectedPageId[key()] ||= getState().pages[0].id;
        setStatus(`Switched to ${opt.name}.`, 'neutral');
        render();
      };
      els.optionTabs.appendChild(b);
    });

    els.scenarioTabs.innerHTML = '';
    Object.entries(SCENARIOS).forEach(([id,sc]) => {
      const b = document.createElement('button');
      b.className = `seg-btn ${String(app.scenario)===id?'active':''}`;
      b.textContent = `S${id}. ${sc.title}`;
      b.onclick = () => {
        if (app.drag) finishDrag(false);
        app.scenario = Number(id);
        getState();
        app.selectedPageId[key()] ||= getState().pages[0].id;
        setStatus(`Scenario ${id} loaded.`, 'neutral');
        render();
      };
      els.scenarioTabs.appendChild(b);
    });

    const showCMoveMode = app.option === 'C';
    els.cMoveMode.classList.toggle('hidden', !showCMoveMode);
    els.cMovePushToggle.checked = app.cExistingMoveBounded;
  }

  function renderHeader() {
    const sc = SCENARIOS[app.scenario];
    const opt = OPTIONS[app.option];
    els.scenarioNumber.textContent = `Scenario ${app.scenario} / ${opt.short}`;
    els.scenarioTitle.textContent = sc.title;
    els.scenarioDescription.textContent = sc.description;
    els.ruleName.textContent = opt.name;
    els.ruleDescription.textContent = opt.description;
    els.undoBtn.disabled = !(app.histories[key()]?.length);

    const next = newGradient(app.newCounter);
    const bg = `linear-gradient(145deg, ${next[0]}, ${next[1]})`;
    els.palette1.style.background = bg;
    els.palette2.style.background = bg;
  }

  function renderRows(surface) {
    for (let i=0; i<3; i++) {
      const row = document.createElement('div');
      row.className = 'surface-row';
      row.innerHTML = `<span>R${i+1}</span>`;
      surface.appendChild(row);
    }
  }

  function cardMetrics(surface, start, size) {
    const rect = surface.getBoundingClientRect();
    const styles = getComputedStyle(surface);
    const gap = parseFloat(styles.rowGap || '0') || 0;
    const rowH = (rect.height - gap * 2) / 3;
    return {
      top: start * (rowH + gap),
      height: size * rowH + (size - 1) * gap
    };
  }

  function renderSurface(surface, state, page, context) {
    surface.innerHTML = '';
    surface.dataset.pageId = page.id;
    surface.dataset.context = context;
    renderRows(surface);

    const placements = pagePlacements(state,page);
    placements.forEach(pl => {
      const w = state.widgets[pl.id];
      if (!w) return;
      const card = document.createElement('div');
      const metrics = cardMetrics(surface,pl.start,pl.size);
      card.className = `widget-card ${app.drag?.widget.id===w.id && app.preview ? 'drag-preview':''}`;
      card.style.top = `${metrics.top}px`;
      card.style.height = `${metrics.height}px`;
      card.style.background = widgetBackground(w);
      card.dataset.widgetId = w.id;
      card.dataset.animKey = `${context}:${w.id}`;
      card.innerHTML = `<span class="card-title">${w.label}</span><span class="card-meta">${w.size===2?'1x2 / 2 rows':'1x1 / 1 row'}</span><button class="widget-delete" title="Delete">x</button>`;
      card.addEventListener('pointerdown', ev => startDragExisting(w.id,ev));
      card.querySelector('.widget-delete').addEventListener('click', ev => { ev.stopPropagation(); deleteWidget(w.id); });
      surface.appendChild(card);
    });

    if (app.drag?.targetPageId === page.id) {
      surface.classList.toggle('target-ok', !!app.drag.valid);
      surface.classList.toggle('target-bad', !app.drag.valid);
      const marker = document.createElement('div');
      marker.className = 'drop-marker';
      marker.style.top = `${Math.max(3, Math.min(97, app.drag.markerRatio * 100))}%`;
      surface.appendChild(marker);
    } else {
      surface.classList.remove('target-ok','target-bad');
    }
  }

  function renderMainRail() {
    const state = getDisplayState();
    const id = selectedPageId();
    const pageIndex = Math.max(0, state.pages.findIndex(p=>p.id===id));
    const page = state.pages[pageIndex] || state.pages[0];
    if (!page) return;
    app.selectedPageId[key()] = page.id;
    els.currentPageLabel.textContent = `P${pageIndex+1}${page.spill?' / SPILL':''}`;
    renderSurface(els.mainRail, state, page, `rail-${page.id}`);

    els.pageDots.innerHTML = '';
    state.pages.forEach((p,i) => {
      const dot = document.createElement('button');
      dot.className = `page-dot ${p.id===page.id?'active':''}`;
      dot.title = `P${i+1}`;
      dot.onclick = () => setSelectedPage(p.id);
      els.pageDots.appendChild(dot);
    });
    els.prevPageBtn.disabled = pageIndex <= 0;
    els.nextPageBtn.disabled = pageIndex >= state.pages.length - 1;
    renderDragPageZones(state, pageIndex);
  }

  function renderOverview() {
    const state = getDisplayState();
    const selected = selectedPageId();
    els.pageOverview.innerHTML = '';
    state.pages.forEach((page,i) => {
      const wrap = document.createElement('article');
      wrap.className = `mini-page ${page.id===selected?'active':''} ${page.spill?'spill':''}`;
      wrap.innerHTML = `<div class="mini-page-head"><span>P${i+1}</span><span class="mini-page-head-actions">${page.spill?'<span class="spill-badge">SPILL</span>':''}<button class="mini-page-delete" title="Delete this page" aria-label="Delete P${i+1}">x</button></span></div>`;
      const pageDelete = wrap.querySelector('.mini-page-delete');
      pageDelete.addEventListener('pointerdown', ev => ev.stopPropagation());
      pageDelete.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); deletePageById(page.id); });
      const surface = document.createElement('div');
      surface.className = 'page-surface mini-surface';
      surface.addEventListener('click', ev => { if (!ev.target.closest('.widget-card')) setSelectedPage(page.id); });
      wrap.appendChild(surface);
      els.pageOverview.appendChild(wrap);
      renderSurface(surface,state,page,`mini-${page.id}`);
    });
  }

  function render() {
    renderControls();
    renderHeader();
    renderMainRail();
    renderOverview();
  }

  els.palette1.addEventListener('pointerdown', ev => startDragFromPalette(1,ev));
  els.palette2.addEventListener('pointerdown', ev => startDragFromPalette(2,ev));
  els.cMovePushToggle.addEventListener('change', () => {
    if (app.drag) finishDrag(false);
    app.cExistingMoveBounded = els.cMovePushToggle.checked;
    setStatus(
      app.cExistingMoveBounded
        ? 'C exception ON: existing cross-page moves reuse capacity only between the source and target pages. No Spill Page is created; unaffected pages stay untouched.'
        : 'C exception OFF: existing cross-page moves use the original Page-local + Spill rule.',
      'neutral'
    );
    render();
  });
  els.undoBtn.onclick = undo;
  els.resetBtn.onclick = resetCurrent;
  els.doneBtn.onclick = cleanupEmptyPages;
  els.addPageBtn.onclick = addPageAfterCurrent;
  els.deletePageBtn.onclick = deleteCurrentPage;
  els.runScenarioBtn.onclick = runScenarioAction;
  els.prevPageBtn.onclick = () => {
    const state = getDisplayState();
    const idx = state.pages.findIndex(p=>p.id===selectedPageId());
    if (idx > 0) setSelectedPage(state.pages[idx-1].id);
  };
  els.nextPageBtn.onclick = () => {
    const state = getDisplayState();
    const idx = state.pages.findIndex(p=>p.id===selectedPageId());
    if (idx >= 0 && idx < state.pages.length-1) setSelectedPage(state.pages[idx+1].id);
  };

  getState();
  app.selectedPageId[key()] = getState().pages[0].id;
  render();
})();
