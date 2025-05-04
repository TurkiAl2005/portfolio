import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: 'https://github.com/TurkiAlrasheed/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false, 
        writable: false,
        configurable: false,
      });

      return ret;
    });
}

function renderCommitInfo(data, commits) {
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
    dl.append('dt').html('Total lines of code');
    dl.append('dd').text(data.length);
  
    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);
  
    const fileCount = d3.groups(data, d => d.file).length;
    dl.append('dt').text('Number of files');
    dl.append('dd').text(fileCount);
  
    
  
    const fileLengths = d3.rollups(
      data,
      v => d3.max(v, d => d.line),
      d => d.file
    );
    const avgFileLength = d3.mean(fileLengths, d => d[1]);
    dl.append('dt').text('Average file length');
    dl.append('dd').text(avgFileLength.toFixed(1));

  
    const periodCounts = d3.rollups(
      commits,
      v => v.length,
      d => {
        const h = d.hourFrac;
        if (h < 6) return 'night';
        if (h < 12) return 'morning';
        if (h < 18) return 'afternoon';
        return 'evening';
      }
    );
    const [topPeriod, topCount] = d3.greatest(periodCounts, d => d[1]);
    dl.append('dt').text('Most active time of day');
    dl.append('dd').text(`${topPeriod} (${topCount} commits)`);
  }
  let xScale, yScale;
  function renderScatterPlot(data, commits) {
    const width = 1000;
    const height = 600;
  
    const svg = d3
      .select('#chart')
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('overflow', 'visible');
      const margin = { top: 10, right: 10, bottom: 30, left: 40 };

      const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
      };
      
      xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([usableArea.left, usableArea.right])
        .nice();

        yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);
      
        const gridlines = svg
        .append('g')
        .attr('class', 'gridlines')
        .attr('transform', `translate(${usableArea.left}, 0)`);

        gridlines.call(
        d3.axisLeft(yScale)
        .tickFormat('')             
        .tickSize(-usableArea.width) 
        );
      const xAxis = d3.axisBottom(xScale);
      const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');
      
      
      svg.append('g')
        .attr('transform', `translate(0, ${usableArea.bottom})`)
        .call(xAxis);
      
      
      svg.append('g')
        .attr('transform', `translate(${usableArea.left}, 0)`)
        .call(yAxis);
    
    const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);

    const rScale = d3.scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]); 
    const sortedCommits = d3.sort(commits, d => -d.totalLines);
    const dots = svg.append('g').attr('class', 'dots');
  
    dots
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
    createBrushSelector(svg);
     
  }
  function renderTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
  
    if (Object.keys(commit).length === 0) return;
  
    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
      dateStyle: 'full',
    });
  }
  function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
  }
  function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
  }
  function createBrushSelector(svg) {
    svg.call(d3.brush().on('start brush end', brushed));
    svg.selectAll('.dots, .overlay ~ *').raise();
  }
  function isCommitSelected(selection, commit) {
    if (!selection) return false;
  
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);
  
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }
  function brushed(event) {
    const selection = event.selection;
    d3.selectAll('circle').classed('selected', (d) =>
      isCommitSelected(selection, d),
    );
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }
  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
  
    const countElement = document.querySelector('#selection-count');
    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;
  
    return selectedCommits;
  }
  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];
    const container = document.getElementById('language-breakdown');
  
    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }
  
    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines);
  
    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type,
    );
  
    container.innerHTML = ''; 

    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);

      const row = document.createElement('div');
      row.className = 'language-row';

      row.innerHTML = `
        <div class="lang-name">${language}</div>
        <div class="lang-count">${count} lines (${formatted})</div>
      `;

      container.appendChild(row);
    }
  }

  let data = await loadData();
  let commits = processCommits(data);
  
  
  renderCommitInfo(data, commits);
  renderScatterPlot(data, commits);