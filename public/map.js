import {config} from './keys.js';

const markers = {};
let initiatingMarkerForm = false;

const map = new maplibregl.Map({
    container: 'map',
    style: `https://api.maptiler.com/maps/bright/style.json?key=${config.keys.maptiler}`,
    center: [5.27,52.19],
    zoom: 6
});

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
}
setup();

const markerDragend = function(e) {
    const marker = markers[e.target.id];
    if (marker) {
        updateVraagAanbod(marker.id);
    }
}

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
    const response = await fetch(`/${id}`, {
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

const initiateMarkerForm = function(markerId) {
    initiatingMarkerForm = true;
    const markerform = document.querySelector('#markerform');
    const marker = markers[markerId];
    if (marker) {
        
        markerform.querySelector('input[name="id"]').value = marker.id;
        markerform.querySelector('#vraag').checked = !marker.supply; 
        markerform.querySelector('#aanbod').checked = marker.supply; 
        markerform.querySelector('input[name="title"]').value = marker.title;
        markerform.classList.remove('hidden');
    } else {
        markerform.classList.add('hidden');
    }
    initiatingMarkerForm = false;
}
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
function createMarker(id, long, lat, title, supply) {
    const marker = new maplibregl.Marker({color: supply ? 'red': 'green', draggable: true})
        .setLngLat([long, lat]) // Set the position to the clicked point
        .addTo(map); // Add the marker to the map
    marker.id = id;
    marker.title = title;
    marker.supply = supply;
    marker.getElement().classList.add('marker');
    marker.getElement().addEventListener('click', (e)=>markerSelect(e, marker));
    marker.on('dragend', (e)=>markerDragend(e));
    markers[id] = marker;
    return marker;
}
async function removeVraagAanbod(id) {
    const marker = markers[id];
    if (marker) {
        const response = await fetch(`/${id}/delete`, {
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
map.on('load', (e) => {
    const features = JSON.parse(document.getElementById('map').getAttribute('data-points'));
    for (const feature of features) {
        createMarker(feature.id, feature.longitude, feature.latitude, feature.title, feature.supply);
    }
})
map.on('click', async function(e) {
    const title = 'Zonder titel';
    const supply = false;
    const response = await fetch('/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: title,
            supply: supply,
            longitude: e.lngLat.lng,
            latitude: e.lngLat.lat,
            _csrf: document.querySelector('input[name="_csrf"]').value
        })
    });
    if (response.ok) {
        const data = await response.json();
        createMarker(data.id, e.lngLat.lng, e.lngLat.lat, title, supply);
        markerSelect(e, markers[data.id])
    } else {
        markerSelect(e, null);
    }
});