const state = {
  intent: null,
  role: null,
  selectedAddress: null,
  addressData: null,
  contractUploaded: false
};

const rolleSection = document.getElementById("rolleSection");
const adresseSection = document.getElementById("adresseSection");
const sporgsmalSection = document.getElementById("sporgsmalSection");
const resultatSection = document.getElementById("resultat");
const uploadSection = document.getElementById("upload");

const adresseInput = document.getElementById("adresseInput");
const adresseResultater = document.getElementById("adresseResultater");
const valgtAdresse = document.getElementById("valgtAdresse");
const ejendomsData = document.getElementById("ejendomsData");
const sporgsmalIndhold = document.getElementById("sporgsmalIndhold");
const resultatBox = document.getElementById("resultatBox");
const uploadForm = document.getElementById("uploadForm");
const uploadStatus = document.getElementById("uploadStatus");

let debounceTimer;

function showSection(element) {
  element.classList.remove("hidden");
}

function hideSection(element) {
  element.classList.add("hidden");
}

function startFlow(intent) {
  state.intent = intent;
  state.role = null;
  state.selectedAddress = null;
  state.addressData = null;

  showSection(rolleSection);
  hideSection(adresseSection);
  hideSection(sporgsmalSection);
  hideSection(resultatSection);

  if (intent === "kontrakt") {
    showSection(uploadSection);
  }
}

function setRole(role) {
  state.role = role;
  showSection(adresseSection);
  showSection(uploadSection);
  renderNextStep();
}

function renderNextStep() {
  showSection(sporgsmalSection);

  let html = `
    <p><strong>Valgt spor:</strong> ${APP_CONFIG.intents[state.intent] || "-"}</p>
    <p><strong>Rolle:</strong> ${state.role || "-"}</p>
  `;

  if (state.intent === "lejeberegning") {
    html += `
      <label>Hvilken type lejemål tror du, det er?</label>
      <select id="kontraktsporSelect">
        ${APP_CONFIG.kontraktspor.map(item => `<option value="${item.value}">${item.label}</option>`).join("")}
      </select>
      <button class="primary-btn" onclick="saveKontraktspor()">Fortsæt</button>
    `;
  }

  if (state.intent === "lejetype") {
    html += `
      <p>Vi hjælper dig først med at finde type lejemål og derefter næste dokumentation.</p>
    `;
  }

  if (state.intent === "kontrakt") {
    html += `
      <p>Upload kontrakten, så kan vi senere bruge den i vurderingen.</p>
    `;
  }

  sporgsmalIndhold.innerHTML = html;
}

function saveKontraktspor() {
  const value = document.getElementById("kontraktsporSelect").value;
  state.kontraktspor = value;

  showSection(resultatSection);
  resultatBox.innerHTML = `
    <p><strong>Foreløbig status</strong></p>
    <p>Intent: ${state.intent}</p>
    <p>Rolle: ${state.role}</p>
    <p>Kontraktspor: ${value}</p>
    <p>Næste trin bliver at kombinere dette med ejendomsdata og senere kontraktdata.</p>
  `;
}

function renderAdresseData(adresse) {
  valgtAdresse.classList.remove("hidden");
  valgtAdresse.innerHTML = `
    <strong>Valgt adresse:</strong><br>
    ${adresse.betegnelse || adresse.tekst || "-"}
  `;

  ejendomsData.classList.remove("hidden");
  ejendomsData.innerHTML = `
    <strong>Grunddata</strong><br>
    Adresse-id: ${adresse.id ?? "-"}<br>
    Vejnavn: ${adresse.vejnavn ?? "-"}<br>
    Husnr.: ${adresse.husnr ?? "-"}<br>
    Postnr.: ${adresse.postnr ?? "-"}<br>
    Postdistrikt: ${adresse.postnrnavn ?? "-"}<br>
    Kommunekode: ${adresse.kommunekode ?? "-"}
  `;
}

adresseInput.addEventListener("input", function () {
  const query = adresseInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 3) {
    adresseResultater.style.display = "none";
    adresseResultater.innerHTML = "";
    return;
  }

  debounceTimer = setTimeout(async () => {
    try {
      const response = await fetch(`https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      adresseResultater.innerHTML = "";

      if (!data.length) {
        adresseResultater.style.display = "none";
        return;
      }

      data.slice(0, 8).forEach(item => {
        const div = document.createElement("div");
        div.className = "result-item";
        div.textContent = item.tekst;

        div.addEventListener("click", () => {
          const adresse = item.adresse || item.data?.adgangsadresse || null;
          adresseInput.value = item.tekst;
          adresseResultater.innerHTML = "";
          adresseResultater.style.display = "none";

          state.selectedAddress = item.tekst;
          state.addressData = adresse;

          if (adresse) {
            adresse.betegnelse = item.tekst;
            renderAdresseData(adresse);
            showSection(resultatSection);
            resultatBox.innerHTML = `
              <p><strong>Næste skridt:</strong></p>
              <p>Nu har vi adressen. Senere skal vi hente BBR, ejeroplysninger og lejelogik via backend.</p>
            `;
          }
        });

        adresseResultater.appendChild(div);
      });

      adresseResultater.style.display = "block";
    } catch (error) {
      console.error("Fejl ved adresseopslag:", error);
    }
  }, 250);
});

document.addEventListener("click", function (e) {
  if (!e.target.closest(".address-search")) {
    adresseResultater.style.display = "none";
  }
});

uploadForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const fileInput = document.getElementById("contractFile");
  const file = fileInput.files[0];

  if (!file) {
    uploadStatus.classList.remove("hidden");
    uploadStatus.innerHTML = "Vælg en fil først.";
    return;
  }

  const formData = new FormData();
  formData.append("contract", file);

  try {
    const response = await fetch("/upload-contract", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    state.contractUploaded = true;

    uploadStatus.classList.remove("hidden");
    uploadStatus.innerHTML = `Upload gennemført: ${result.filename}`;
  } catch (error) {
    uploadStatus.classList.remove("hidden");
    uploadStatus.innerHTML = "Upload fejlede.";
  }
});
