// Global array to store image files and their data URLs
let uploadedImages = [];
let sortableList;

// --- DOM Element References ---
const uploadInput = document.getElementById('image-upload');
const imageListContainer = document.getElementById('image-list');
const convertButton = document.getElementById('convert-button');
const clearButton = document.getElementById('clear-images');
const compressionRange = document.getElementById('compression-range');
const compressionValueSpan = document.getElementById('compression-value');

// New Toggle Elements
const orientationToggle = document.getElementById('orientation-toggle');
const orientationSelect = document.getElementById('orientation-select'); // Hidden input for value
const autoLabel = document.getElementById('auto-label');
const portraitLabel = document.getElementById('portrait-label');

const previewContainer = document.getElementById('preview-container');
const settingsContainer = document.getElementById('settings-container');
const conversionStatus = document.getElementById('conversion-status');
const progressBar = document.getElementById('progress-bar');
const statusText = document.getElementById('status-text');
const spinner = document.getElementById('spinner');


// --- Initialization ---

/**
 * Initializes SortableJS for drag-and-drop reordering.
 */
function initSortable() {
    sortableList = new Sortable(imageListContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost', 
        onEnd: function(evt) {
            const movedItem = uploadedImages.splice(evt.oldIndex, 1)[0];
            uploadedImages.splice(evt.newIndex, 0, movedItem);
        }
    });
}

/**
 * Handles the logic for the futuristic orientation toggle switch.
 */
function handleOrientationToggle() {
    // Current value is stored in the hidden input
    let currentValue = orientationSelect.value;
    
    // Logic: auto -> portrait -> landscape (using 'auto' for landscape option in the design)
    if (currentValue === 'auto') {
        currentValue = 'portrait';
    } else if (currentValue === 'portrait') {
        currentValue = 'auto'; // Re-using 'auto' as the third option
    } else {
        currentValue = 'auto';
    }

    orientationSelect.value = currentValue;
    updateOrientationUI(currentValue);
}

/**
 * Updates the visual state of the orientation toggle based on the value.
 */
function updateOrientationUI(value) {
    // Note: The design uses AUTO/PORTRAIT labels with a third state for the toggle
    // We'll use 'auto' as the default/left state and 'portrait' as the right state.
    // In the PDF logic, 'auto' will check both portrait and landscape images.

    if (value === 'auto') {
        orientationToggle.classList.remove('active');
        autoLabel.classList.add('active');
        portraitLabel.classList.remove('active');
    } else { // Covers 'portrait'
        orientationToggle.classList.add('active');
        autoLabel.classList.remove('active');
        portraitLabel.classList.add('active');
    }
}


/**
 * Updates the visibility and state of UI elements.
 */
function updateUIState() {
    const hasImages = uploadedImages.length > 0;
    
    // Hide placeholders when images are present
    document.querySelectorAll('.thumbnail-placeholder').forEach(p => {
        p.classList.toggle('hidden', hasImages);
    });

    // Toggle Button State
    convertButton.disabled = !hasImages;

    // Update Image List Empty State
    const emptyState = imageListContainer.querySelector('.empty-state');
    if (hasImages && emptyState) {
        emptyState.classList.add('hidden');
    } else if (!hasImages && emptyState) {
        emptyState.classList.remove('hidden');
    }
}

// --- File Handling Functions ---

/**
 * Converts a File object into a Promise that resolves with an object
 * containing the file name, data URL, and image dimensions. (Same as before)
 * @param {File} file - The image file object.
 */
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                resolve({
                    name: file.name,
                    dataUrl: e.target.result,
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            img.onerror = function(err) {
                reject(`Failed to load image: ${file.name}`);
            };
            img.src = e.target.result;
        };

        reader.onerror = function(err) {
            reject(`Failed to read file: ${file.name}`);
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Handles the selection of new files from the input element. (Same core logic)
 */
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp']; 

    // Limit files to 20
    const newFiles = files.slice(0, 20 - uploadedImages.length);

    if (newFiles.length === 0 && uploadedImages.length >= 20) {
        alert('Maximum of 20 images reached. Clear some images to upload more.');
        return;
    }

    const promises = newFiles
        .filter(file => validImageTypes.includes(file.type))
        .map(fileToDataUrl);

    try {
        const results = await Promise.allSettled(promises);

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                uploadedImages.push(result.value);
                renderImageThumbnail(result.value);
            } else {
                console.error(result.reason);
            }
        });

        uploadInput.value = null;
        updateUIState();

    } catch (error) {
        console.error('Error processing files:', error);
    }
}

/**
 * Clears the image list and resets the application state.
 */
function clearAllImages() {
    if (confirm('Are you sure you want to remove all uploaded images?')) {
        uploadedImages = [];
        imageListContainer.innerHTML = ''; // Clear DOM

        // Re-add the placeholder text and boxes
        const p = document.createElement('p');
        p.className = 'empty-state';
        p.textContent = 'Images will appear here. Drag to reorder';
        imageListContainer.appendChild(p);
        for(let i = 0; i < 6; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'thumbnail-placeholder';
            imageListContainer.appendChild(placeholder);
        }

        updateUIState();
        resetConversionStatus();
    }
}

// --- UI Rendering Functions ---

/**
 * Renders a draggable thumbnail for an uploaded image.
 */
function renderImageThumbnail(imageObj) {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.setAttribute('data-name', imageObj.name);

    const img = document.createElement('img');
    img.src = imageObj.dataUrl;
    img.alt = imageObj.name;
    img.draggable = false; 

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => removeImage(imageObj.name, item);

    item.appendChild(img);
    item.appendChild(removeBtn);
    
    // Add to the start of the list to push the placeholders down/out
    imageListContainer.prepend(item);
}

/**
 * Removes an image from both the DOM and the uploadedImages array.
 */
function removeImage(name, item) {
    uploadedImages = uploadedImages.filter(img => img.name !== name);
    item.remove();
    updateUIState();
}

/**
 * Updates the displayed compression quality value.
 */
function updateCompressionValue() {
    const value = (parseFloat(compressionRange.value) * 100).toFixed(0);
    compressionValueSpan.textContent = `${value}%`;
}


// --- PDF Generation Functions (Same core logic, just updated UI feedback) ---

function resetConversionStatus() {
    conversionStatus.classList.add('hidden');
    progressBar.style.width = '0%';
    statusText.textContent = 'Processing...';
    spinner.classList.add('hidden');
    convertButton.disabled = uploadedImages.length === 0 ? true : false;
}

function updateConversionProgress(percent, message) {
    conversionStatus.classList.remove('hidden');
    progressBar.style.width = `${percent}%`;
    statusText.textContent = message;
    spinner.classList.remove('hidden');
}

async function convertImagesToPdf() {
    convertButton.disabled = true;
    updateConversionProgress(5, 'Initializing PDF...');

    const quality = parseFloat(compressionRange.value);
    // Get the value from the hidden input
    const selectedOrientation = orientationSelect.value; 
    const { jsPDF } = window.jspdf;
    
    // PDF page size (standard A4 in points)
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 10; 

    let doc = new jsPDF({
        unit: 'pt',
        format: 'a4',
        orientation: 'p' 
    });

    doc.deletePage(1);

    for (let i = 0; i < uploadedImages.length; i++) {
        const imgObj = uploadedImages[i];
        const { dataUrl, width: imgW, height: imgH } = imgObj;
        
        updateConversionProgress(5 + (i / uploadedImages.length) * 90, `Adding image ${i + 1} of ${uploadedImages.length}...`);

        // --- 1. Determine Image Orientation ---
        const isImageLandscape = imgW > imgH;
        let pageW, pageH, pdfOrientation;

        if (selectedOrientation === 'auto') {
            // Auto-detect: match page orientation to the image orientation
            pdfOrientation = isImageLandscape ? 'l' : 'p';
        } else if (selectedOrientation === 'portrait') {
            pdfOrientation = 'p'; // Force Portrait
        } else {
            // Default to portrait
            pdfOrientation = 'p'; 
        }

        // Set page dimensions based on the determined orientation
        if (pdfOrientation === 'l') {
            pageW = A4_HEIGHT;
            pageH = A4_WIDTH;
        } else {
            pageW = A4_WIDTH;
            pageH = A4_HEIGHT;
        }

        doc.addPage([pageW, pageH], pdfOrientation);

        // --- 2. Calculate Scaling and Positioning (Fit to Page) ---
        const maxPageW = pageW - 2 * MARGIN;
        const maxPageH = pageH - 2 * MARGIN;
        
        const widthRatio = maxPageW / imgW;
        const heightRatio = maxPageH / imgH;
        
        const ratio = Math.min(widthRatio, heightRatio);
        
        const pdfW = imgW * ratio;
        const pdfH = imgH * ratio;

        const xPos = MARGIN + (maxPageW - pdfW) / 2;
        const yPos = MARGIN + (maxPageH - pdfH) / 2;

        // --- 3. Add Image to PDF ---
        const imageType = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

        doc.addImage(
            dataUrl, 
            imageType, 
            xPos, 
            yPos, 
            pdfW, 
            pdfH, 
            null,       
            'FAST',     
            0,          
            quality     
        );
        
        await new Promise(r => setTimeout(r, 10));
    }

    // --- 4. Finalize and Download ---
    updateConversionProgress(95, 'Finalizing and downloading...');

    const filename = `QuantumFlow_document_${Date.now()}.pdf`;
    
    doc.save(filename);

    updateConversionProgress(100, '✅ Conversion Complete!');
    spinner.classList.add('hidden');
    
    setTimeout(() => {
        resetConversionStatus();
    }, 3000);
}

// --- Event Listeners and Setup ---

document.addEventListener('DOMContentLoaded', () => {
    initSortable();
    updateCompressionValue();
    updateUIState();
    updateOrientationUI(orientationSelect.value); // Set initial state
    resetConversionStatus();
});

// Main Event Listeners
uploadInput.addEventListener('change', handleFileSelect);
convertButton.addEventListener('click', convertImagesToPdf);
clearButton.addEventListener('click', clearAllImages);
compressionRange.addEventListener('input', updateCompressionValue);

// Toggle Event Listeners
orientationToggle.addEventListener('click', handleOrientationToggle);
autoLabel.addEventListener('click', () => {
    orientationSelect.value = 'auto';
    updateOrientationUI('auto');
});
portraitLabel.addEventListener('click', () => {
    orientationSelect.value = 'portrait';
    updateOrientationUI('portrait');
});
