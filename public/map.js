import {config} from './keys.js';

const markers = {};
let initiatingMarkerForm = false;

// create map showing the Netherlands
const map = new maplibregl.Map({
    container: 'map',
    style: `https://api.maptiler.com/maps/bright/style.json?key=${config.keys.maptiler}`,
    center: [5.27,52.19],
    zoom: 6
});

// update color of marker
function setMarkerColor(id, color) {
    const marker = markers[id];
    if (marker) {
        const svgElement = marker.getElement().querySelector('svg');
        const pathElement = svgElement.querySelectorAll('g[fill]')[1];
        if (pathElement) {
            pathElement.setAttribute('fill', color);
        }
    }
}

let timer = null;
const handleKeyUp = (e) => {
    e.preventDefault();
    if (initiatingMarkerForm) {
        return;
    }
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(async () => {
        const id = markerform.querySelector('input[name="id"]').value;
        const updated = await updateVraagAanbod(id);
    }, 1500);
}
// setup marker form and handlers
const setup = async () => {
    const markerform = document.querySelector('#markerform');
    markerform.querySelector('input[name="delete"]').addEventListener('click', (e) => {
        e.preventDefault();
        const id = markerform.querySelector('input[name="id"]').value;
        removeVraagAanbod(id);
    });
    const radiobuttons = markerform.querySelectorAll('input[type="radio"]');
    radiobuttons.forEach(radiobutton=>radiobutton.addEventListener('change', async (e) => {
        e.preventDefault();
        if (initiatingMarkerForm) {
            return;
        }
        const id = markerform.querySelector('input[name="id"]').value;
        const updated = await updateVraagAanbod(id);        
    }));
    // setup handler for text inputs, update if typing stopped for more than 2 seconds
    const textinputs = markerform.querySelectorAll('input[type="text"]');
    textinputs.forEach(textinput=>textinput.addEventListener('keyup', (e) => handleKeyUp(e)));
    markerform.querySelector('textarea').addEventListener('keyup', (e) => handleKeyUp(e));
}
setup();

// handler for dragged marker
const markerDragend = function(e) {
    const marker = markers[e.target.id];
    if (marker) {
        updateVraagAanbod(marker.id);
    }
}

// update vraag en aanbod in database, update UI if successful
const updateVraagAanbod = async function(id) {
    const marker = markers[id];
    if (!marker) {
        console.error('update: marker id not found')
        return;
    }
    const markerform = document.querySelector('#markerform');
    const formData = new FormData(markerform);
    const formValues = Object.fromEntries(formData.entries());
    const lngLat = marker.getLngLat();
    formValues.longitude = lngLat.lng;
    formValues.latitude = lngLat.lat;
    formValues.supply = formValues.issupply === '0' ? false : true;
    const response = await fetch(`./${id}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: formValues.id,
            longitude: formValues.longitude,
            latitude: formValues.latitude,
            title: formValues.title,
            supply: formValues.supply,
            description: formValues.description,
            _csrf: formValues._csrf
        })
    });
    if (response.ok) {
        const data = await response.json();
        if (data.id == id) {
            marker.longitude = formValues.longitude;
            marker.latitude = formValues.latitude;
            marker.supply = formValues.supply;
            marker.title = formValues.title;
            marker.description = formValues.description;
            if (marker.supply) {
                setMarkerColor(id, 'red');
            } else {
                setMarkerColor(id, 'green');
            }
            return true;
        } else {
            console.error('update failed: no confirmation');
            setMarkerColor(id, 'gray');
            return false;
        }
    } else {
        console.error('update failed: invalid response');
        setMarkerColor(id, 'gray');
        return false;
    }
}

// update marker form to selected marker
const initiateMarkerForm = function(markerId) {
    initiatingMarkerForm = true;
    const markerform = document.querySelector('#markerform');
    const marker = markers[markerId];
    if (marker) {
        markerform.querySelector('input[name="id"]').value = marker.id;
        markerform.querySelector('#vraag').checked = !marker.supply; 
        markerform.querySelector('#aanbod').checked = marker.supply; 
        markerform.querySelector('input[name="title"]').value = marker.title;
        markerform.querySelector('textarea[name="description"]').value = marker.description;
        markerform.classList.remove('hidden');
    } else {
        markerform.classList.add('hidden');
    }
    initiatingMarkerForm = false;
}

// handler for marker selection
let prevSelectedMarker = -1;
const markerSelect = function(e, marker) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    markers[prevSelectedMarker]?.getElement().classList.remove('selected');
    markers[marker?.id]?.getElement().classList.add('selected');
    prevSelectedMarker = marker?.id;
    initiateMarkerForm(marker?.id);
}

// create marker and setups handlers
function createMarker(id, long, lat, title, supply, description) {
    const marker = new maplibregl.Marker({color: supply ? 'red': 'green', draggable: true})
        .setLngLat([long, lat]) // Set the position to the clicked point
        .addTo(map); // Add the marker to the map
    marker.id = id;
    marker.title = title;
    marker.supply = supply;
    marker.description = description;
    marker.getElement().classList.add('marker');
    marker.getElement().addEventListener('click', (e)=>markerSelect(e, marker));
    marker.on('dragstart', (e)=>markerSelect(e, marker));
    marker.on('dragend', (e)=>markerDragend(e));
    markers[id] = marker;
    return marker;
}

// remove marker from database and update GUI
async function removeVraagAanbod(id) {
    const marker = markers[id];
    if (marker) {
        const response = await fetch(`./${id}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                _csrf: document.querySelector('input[name="_csrf"]').value
            })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.id === id) {
                marker.remove();
                initiateMarkerForm(null);
                delete markers[id];
            }
        }
    }
}

// add markers with marker handlers to map
map.on('load', (e) => {
    const features = JSON.parse(document.getElementById('map').getAttribute('data-points'));
    for (const feature of features) {
        createMarker(feature.id, 
            feature.longitude, 
            feature.latitude, 
            feature.title, 
            feature.supply,
            feature.description);
    }
})

// add map click handler to add new markers
map.on('click', async function(e) {
    const title = 'Zonder titel';
    const supply = false;
    const description = '';
    const response = await fetch('./', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title,
            supply: supply,
            longitude: e.lngLat.lng,
            latitude: e.lngLat.lat,
            entrydate: Math.floor(new Date().getTime() / 1000),
            _csrf: document.querySelector('input[name="_csrf"]').value
        })
    });
    if (response.ok) {
        const data = await response.json();
        createMarker(data.id, e.lngLat.lng, e.lngLat.lat, title, supply,description);
        markerSelect(e, markers[data.id])
    } else {
        markerSelect(e, null);
    }
});