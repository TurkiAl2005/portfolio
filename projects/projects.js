import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

const titleEl = document.querySelector('.projects-title');
if (titleEl) {
  titleEl.textContent = `${projects.length} Projects`;
}

let query = '';
let selectedIndex = -1;
let currentFilteredProjects = projects; 

function updatePieChart(projectsData) {
  d3.select('#projects-plot').selectAll('*').remove();
  d3.select('.legend').selectAll('*').remove();

  let rolledData = d3.rollups(
    projectsData,
    (v) => v.length,
    (d) => d.year
  );

  let data = rolledData.map(([year, count]) => ({
    value: count,
    label: year
  }));

  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(data);

  let svg = d3.select('#projects-plot');
  let legend = d3.select('.legend');

  arcData.forEach((d, idx) => {
    svg.append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', colors(idx))
      .attr('class', idx === selectedIndex ? 'selected' : '')
      .on('click', () => {
        selectedIndex = selectedIndex === idx ? -1 : idx;

        svg.selectAll('path')
          .attr('class', (_, i) => (i === selectedIndex ? 'selected' : ''));

        legend.selectAll('li')
          .attr('class', (_, i) => (i === selectedIndex ? 'legend-item selected' : 'legend-item'));

        if (selectedIndex === -1) {
          renderProjects(currentFilteredProjects, projectsContainer, 'h2');
        } else {
          const selectedYear = data[selectedIndex].label;
          const doublyFiltered = currentFilteredProjects.filter(
            (project) => project.year === selectedYear
          );
          renderProjects(doublyFiltered, projectsContainer, 'h2');
        }
      });
  });

  data.forEach((d, idx) => {
    legend.append('li')
      .attr('class', idx === selectedIndex ? 'legend-item selected' : 'legend-item')
      .attr('style', `--color:${colors(idx)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

updatePieChart(projects);

let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value;

  currentFilteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  updatePieChart(currentFilteredProjects);

  if (selectedIndex === -1) {
    renderProjects(currentFilteredProjects, projectsContainer, 'h2');
  } else {
    const selectedYear = d3.rollups(
      currentFilteredProjects,
      (v) => v.length,
      (d) => d.year
    ).map(([year, count]) => ({ value: count, label: year }))[selectedIndex]?.label;

    if (selectedYear) {
      const doublyFiltered = currentFilteredProjects.filter(
        (project) => project.year === selectedYear
      );
      renderProjects(doublyFiltered, projectsContainer, 'h2');
    } else {
      renderProjects(currentFilteredProjects, projectsContainer, 'h2');
    }
  }
});