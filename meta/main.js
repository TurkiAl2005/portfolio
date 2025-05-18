import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// at top of main.js
const fileTypeColors = d3.scaleOrdinal(d3.schemeTableau10);
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
    const statsContainer = d3.select("#stats");
    statsContainer.selectAll("dl").remove(); // Remove old dl before creating a new one

    // Create the dl element
    const dl = d3.select('#stats').append('dl').attr('class', 'stats')
    
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
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
  function updateScatterPlot(data, filteredCommits) {
    const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 20, left: 40 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  // 1) Grab or create the SVG once
  let svg = d3.select("#chart svg");
  if (svg.empty()) {
    svg = d3.select("#chart")
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "visible");

    // placeholder groups
    svg.append("g").attr("class", "gridlines");
    svg.append("g").attr("class", "x-axis");
    svg.append("g").attr("class", "y-axis");
    svg.append("g").attr("class", "dots");
    createBrushSelector(svg);

  }

  // 2) Scales
  xScale = d3.scaleTime()
    .domain(d3.extent(filteredCommits, d => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // 3) Axes & gridlines
  svg.select(".gridlines")
    .attr("transform", `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));
  svg.select(".x-axis")
    .attr("transform", `translate(0,${usableArea.bottom})`)
    .transition().duration(500)
    .call(d3.axisBottom(xScale));
  svg.select(".y-axis")
    .attr("transform", `translate(${usableArea.left},0)`)
    .transition().duration(500)
    .call(d3.axisLeft(yScale)
      .tickFormat(d => String(d).padStart(2, "0") + ":00"));

  // 4) Radius scale
  const [minLines, maxLines] = d3.extent(filteredCommits, d => d.totalLines);
  const rScale = d3.scaleSqrt()
    .domain([minLines, maxLines])
    .range([5, 35]);

  // 5) ENTER–UPDATE–EXIT
  const dots = svg.select("g.dots");
  const join = dots.selectAll("circle")
    .data(filteredCommits, d => d.id);

  // EXIT: shrink & rise, then remove
  join.exit()
    .transition().duration(300)
    .attr("cy", usableArea.top - 20)
    .attr("r", 0)
    .remove();

  // UPDATE: move & resize
  join.transition().duration(500)
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.hourFrac))
    .attr("r", d => rScale(d.totalLines));

  // ENTER: start below + r=0, then move up + grow
  join.enter().append("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", usableArea.bottom + 50)
    .attr("r", 0)
    .attr("fill", "steelblue")
    .style("fill-opacity", 0.7)
      .on('mouseenter', (event, commit) => {
        d3.select(event.currentTarget).style('fill-opacity', 1);
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget).style('fill-opacity', 0.7);
        updateTooltipVisibility(false);
      }).transition().duration(500)
      .attr("cy", d => yScale(d.hourFrac))
      .attr("r", d => rScale(d.totalLines));

    
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
  commits = commits.sort((a, b) => d3.ascending(a.datetime, b.datetime));
  let filteredCommits = commits;
  let commitProgress = 100;
  
// ===== scrollytelling globals =====
const NUM_ITEMS = commits.length;
const ITEM_HEIGHT = 90;
const VISIBLE_COUNT = 10;
const totalHeight = (NUM_ITEMS - 1) * ITEM_HEIGHT;

const scrollContainer = d3.select('#scroll-container');
const spacer         = d3.select('#spacer');
const itemsContainer = d3.select('#items-container');

spacer.style('height', `${commits.length * ITEM_HEIGHT}px`);
scrollContainer.on('scroll', () => {
  const scrollTop = scrollContainer.property('scrollTop');
  let startIndex = Math.floor(scrollTop / ITEM_HEIGHT);
  startIndex = Math.max(0, Math.min(startIndex, commits.length - VISIBLE_COUNT));
  renderItems(startIndex);
});
renderItems(0);

// ===== Scrollytelling 2 (File Sizes) =====
const FILE_NUM_ITEMS = commits.length;
const FILE_ITEM_HEIGHT = 90;
const FILE_VISIBLE_COUNT = 10;
const FILE_totalHeight = (FILE_NUM_ITEMS - 1) * FILE_ITEM_HEIGHT;

const scrollContainerFile = d3.select('#scroll-container-file');
const spacerFile = d3.select('#spacer-file');
const itemsContainerFile = d3.select('#items-container-file');

spacerFile.style('height', `${FILE_NUM_ITEMS * FILE_ITEM_HEIGHT}px`);

scrollContainerFile.on('scroll', () => {
  const scrollTop = scrollContainerFile.property('scrollTop');
  let startIndex = Math.floor(scrollTop / FILE_ITEM_HEIGHT);
  startIndex = Math.max(0, Math.min(startIndex, FILE_NUM_ITEMS - FILE_VISIBLE_COUNT));
  renderItemsFile(startIndex);
});

renderItemsFile(0);

function renderItemsFile(startIndex) {
  itemsContainerFile.selectAll('div').remove();

  const endIndex = Math.min(startIndex + FILE_VISIBLE_COUNT, commits.length);
  const newCommitSlice = commits.slice(startIndex, endIndex);

  displayCommitFiles(newCommitSlice);

  itemsContainerFile.selectAll('div')
    .data(newCommitSlice)
    .enter()
    .append('div')
    .attr('class', 'item')
    .style('position', 'absolute')
    .style('top', (_, idx) => `${(startIndex + idx) * FILE_ITEM_HEIGHT}px`)
    .html((commit, index) => {
      const fileCount = d3.rollups(commit.lines, D => D.length, d => d.file).length;
      return `
        <p>
          On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, I edited
          <strong>${commit.totalLines}</strong> lines across <strong>${fileCount}</strong> files.
          This pushed my codebase to new complexity!
        </p>
      `;
    });
}
function displayCommitFiles(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);
  
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => ({ name, lines }));

  files = d3.sort(files, (d) => -d.lines.length);

  d3.select('.files').selectAll('div').remove();

  let filesContainer = d3
    .select('.files')
    .selectAll('div')
    .data(files)
    .enter()
    .append('div');

  filesContainer
    .append('dt')
    .html(d => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);

  filesContainer
    .append('dd')
    .selectAll('div')
    .data(d => d.lines)
    .enter()
    .append('div')
    .attr('class', 'line')
    .style('background', d => fileTypeColors(d.type));
}
function renderItems(startIndex) {
  itemsContainer.selectAll('div').remove();

  const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
  const newCommitSlice = commits.slice(startIndex, endIndex);

  updateScatterPlot(data, newCommitSlice);
    //displayCommitFiles(newCommitSlice);
  itemsContainer
    .selectAll('div')
    .data(newCommitSlice)
    .enter()
    .append('div')
    .attr('class', 'item')
    .style('position', 'absolute')
    .style('top', (_, idx) => `${(startIndex + idx) * ITEM_HEIGHT}px`)
    .html((commit, index) => {
      const fileCount = d3.rollups(commit.lines, D => D.length, d => d.file).length;
      return `
        <p>
          On ${commit.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })}, I made
          <a href="${commit.url}" target="_blank">
            ${index > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'}
          </a>.
          I edited <strong>${commit.totalLines}</strong> lines across <strong>${fileCount}</strong> files.
          Then I looked over all I had made, and I saw that it was very good.
        </p>
      `;
    });
}
// Create a new time scale to map progress (0–100) to commit datetimes
const timeScale = d3.scaleTime()
  .domain(d3.extent(commits, d => d.datetime))
  .range([0, 100]);



// Initialize time label

// On slider input


function updateSliderDisplay(progress) {
  const commitMaxTime = timeScale.invert(progress);
  selectedTime.textContent = commitMaxTime.toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short"
  });
  let filteredCommits = commits.filter(d => d.datetime <= commitMaxTime);
  const commitIds = new Set(filteredCommits.map(d => d.id));
  const filteredData = data.filter(d => commitIds.has(d.commit));
  // Update filteredCommits and re-render chart
  filterCommitsByTime(commitMaxTime);
  updateScatterPlot(data, filteredCommits);
  renderCommitInfo(filteredData,filteredCommits)
  renderFileList(filteredCommits);

}
function filterCommitsByTime(maxTime) {
  filteredCommits = commits.filter(c => c.datetime <= maxTime);
}
function renderFileList(filteredCommits) {
    // 1) collect all lines ...
    const lines = filteredCommits.flatMap(d => d.lines);

    // 2) group by file name
    let files = d3.groups(lines, d => d.file)
      .map(([name, fileLines]) => ({ name, lines: fileLines }));
  
    // 2.3) sort descending by number of lines
    files = d3.sort(files, d => -d.lines.length);
  
    // 3) select & clear the container...
  const container = d3.select('dl.files');
  container.selectAll('div').remove();

  // 4) bind & enter a <div> for each file
  const fileBlocks = container.selectAll('div')
    .data(files, d => d.name)
    .enter()
    .append('div');

  // 5) append dt/code and dd
  const dt = fileBlocks.append('dt');
  dt.append('code').text(d => d.name);
  dt.append('small').text(d => `${d.lines.length} lines`);

  // 6) append one .line div per line committed
  const dd = fileBlocks.append('dd');
  dd.selectAll('div')
   .data(d => d.lines)
    .enter()
    .append('div')
    .attr('class', 'line').style('background', d => fileTypeColors(d.type));  // 2.4) color by tech
}
  
  renderCommitInfo(data, commits);
  updateScatterPlot(data, filteredCommits);

  