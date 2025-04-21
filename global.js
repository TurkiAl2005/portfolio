console.log("IT’S ALIVE!");

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'contact/', title: 'Contact' },
  { url: 'resume/', title: 'Resume' },
  { url: 'https://github.com/TurkiAlrasheed', title: 'Github'}
];

let nav = document.createElement('nav');
document.body.prepend(nav);

const BASE_PATH = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ? "/"                  
  : "/portfolio/"; 

  for (let p of pages) {
    let url = !p.url.startsWith('http') ? BASE_PATH + p.url : p.url;
  
    let a = document.createElement('a');
    a.href = url;
    if (p.url.startsWith('http')) a.target = "_blank";
    a.textContent = p.title;
  
    a.classList.toggle(
      'current',
      a.host === location.host && a.pathname === location.pathname
    );
  
    a.toggleAttribute('target', a.host !== location.host);
  
    nav.append(a);
  }

  document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
      Theme:
      <select>
        <option value="light dark">Automatic</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    `
  );

  let select = document.querySelector(".color-scheme select");

  function setColorScheme(value) {
    document.documentElement.style.setProperty("color-scheme", value);
  }
  
  if ("colorScheme" in localStorage) {
    setColorScheme(localStorage.colorScheme);
    select.value = localStorage.colorScheme;
  }
  
  select.addEventListener("input", function (event) {
    let value = event.target.value;
    console.log("color scheme changed to", value);
    setColorScheme(value);
    localStorage.colorScheme = value;
  });
  let form = document.querySelector("form");

form?.addEventListener("submit", function (event) {
  event.preventDefault(); 

  let data = new FormData(form);
  let params = [];

  for (let [name, value] of data) {
    let encoded = `${name}=${encodeURIComponent(value)}`;
    params.push(encoded);
  }

  let url = `${form.action}?${params.join("&")}`;

  location.href = url;
});
export async function fetchJSON(url) {
  try {
    // Fetch the JSON file from the given URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

export function renderProjects(projects, container, headingLevel = 'h2') {
  container.innerHTML = ''; 

  if (!projects || projects.length === 0) {
    container.innerHTML = '<p>No projects found.</p>';
    return;
  }

  projects.forEach((project) => {
    const article = document.createElement('article');
    article.innerHTML = `
  <${headingLevel}>${project.title}</${headingLevel}>
  <p class="project-year">${project.year}</p>
  <img src="${project.image}" alt="${project.title}">
  ${project.url ? `<div class="project-link"><a href="${project.url}" target="_blank" rel="noopener">View on GitHub</a></div>` : ''}
  <p class="project-description">${project.description}</p>  
`;
    container.appendChild(article);
  });
}

export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}



