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
const orientationSelect = document.getElementById('orientation-select');

const previewContainer = document.getElementById('preview-container');
const settingsContainer = document.getElementById('settings-container');
const conversionStatus = document.getElementById('conversion-status');
const progressBar = document.getElementById('progress-bar');
const statusText = document.getElementById('status-text');

// --- Initialization ---

/**
 * Initializes SortableJS for drag-and-drop reordering.
 */
function initSortable() {
    sortableList = new Sortable(imageListContainer, {
        animation: 150,
        ghostClass: 'sortable-ghost', // CSS class for the ghost element
        onEnd: function(evt) {
            // Reorder the main array to match the DOM order
            const movedItem = uploadedImages.splice(evt.oldIndex, 1)[0];
            uploadedImages.splice(evt.newIndex, 0, movedItem);
        }
    });
}

/**
 * Updates the visibility of the preview and settings sections based on image count.
 */
function updateUIState() {
    const hasImages = uploadedImages.length > 0;
    
    // Toggle Section Visibility
    previewContainer.classList.toggle('hidden', !hasImages);
    settingsContainer.classList.toggle('hidden', !hasImages);
    
    // Toggle Button State
    convertButton.disabled = !hasImages;
    convertButton.textContent = hasImages ? 'Generate PDF' : 'Select Images First';

    // Update Image List Empty State
    const emptyState = imageListContainer.querySelector('.empty-state');
    if (hasImages && emptyState) {
        emptyState.remove();
    } else if (!hasImages && !emptyState) {
        const p = document.createElement('p');
        p.className = 'empty-state';
        p.textContent = 'No images selected yet.';
        imageListContainer.appendChild(p);
    }
}

// --- File Handling Functions ---

/**
 * Converts a File object into a Promise that resolves with an object
 * containing the file name, data URL, and image dimensions.
 * @param {File} file - The image file object.
 * @returns {Promise<{name: string, dataUrl: string, width: number, height: number}>}
 */
function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                // Resolve with image data and dimensions
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

        // Reads the file content as a Data URL (Base64)
        reader.readAsDataURL(file);
    });
}

/**
 * Handles the selection of new files from the input element.
 * @param {Event} e - The change event from the file input.
 */
async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp']; // Keep it simple and reliable

    // Limit files to prevent performance issues (e.g., 20)
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

        // Clear the file input so the 'change' event fires again if the same file is selected
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
        updateUIState();
        resetConversionStatus();
    }
}

// --- UI Rendering Functions ---

/**
 * Renders a draggable thumbnail for an uploaded image.
 * @param {object} imageObj - The image object containing name and dataUrl.
 */
function renderImageThumbnail(imageObj) {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.setAttribute('data-name', imageObj.name);

    const img = document.createElement('img');
    img.src = imageObj.dataUrl;
    img.alt = imageObj.name;
    img.draggable = false; // Prevent default browser drag

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '×';
    removeBtn.onclick = () => removeImage(imageObj.name, item);

    item.appendChild(img);
    item.appendChild(removeBtn);
    
    // Append before the empty-state paragraph if it exists
    const emptyState = imageListContainer.querySelector('.empty-state');
    if (emptyState) {
        imageListContainer.insertBefore(item, emptyState);
    } else {
        imageListContainer.appendChild(item);
    }
}

/**
 * Removes an image from both the DOM and the uploadedImages array.
 * @param {string} name - The name of the file to remove.
 * @param {HTMLElement} item - The DOM element to remove.
 */
function removeImage(name, item) {
    // Remove from the array
    uploadedImages = uploadedImages.filter(img => img.name !== name);

    // Remove from the DOM
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


// --- PDF Generation Functions (The Core Logic) ---

/**
 * Resets the conversion status display.
 */
function resetConversionStatus() {
    conversionStatus.classList.add('hidden');
    progressBar.style.width = '0%';
    statusText.textContent = 'Processing images...';
    convertButton.disabled = uploadedImages.length === 0 ? true : false;
}

/**
 * Updates the progress bar and status text.
 * @param {number} percent - Percentage complete (0-100).
 * @param {string} message - The status message.
 */
function updateConversionProgress(percent, message) {
    conversionStatus.classList.remove('hidden');
    progressBar.style.width = `${percent}%`;
    statusText.textContent = message;
}

/**
 * Converts the uploaded images to a single PDF file.
 */
async function convertImagesToPdf() {
    convertButton.disabled = true;
    updateConversionProgress(5, 'Initializing PDF...');

    // Get user settings
    const quality = parseFloat(compressionRange.value);
    const defaultOrientation = orientationSelect.value;
    const { jsPDF } = window.jspdf;
    
    // PDF page size (standard A4 in points: 595.28 x 841.89)
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 10; // Margin in points

    let doc = new jsPDF({
        unit: 'pt',
        format: 'a4',
        orientation: 'p' // Start with portrait, will change per page
    });

    // Remove the initial blank page created by jsPDF
    doc.deletePage(1);

    for (let i = 0; i < uploadedImages.length; i++) {
        const imgObj = uploadedImages[i];
        const { dataUrl, width: imgW, height: imgH } = imgObj;
        
        updateConversionProgress(5 + (i / uploadedImages.length) * 90, `Adding image ${i + 1} of ${uploadedImages.length}...`);

        // --- 1. Determine Image Orientation ---
        const isImageLandscape = imgW > imgH;
        let pageW, pageH, pdfOrientation;

        if (defaultOrientation === 'auto') {
            pdfOrientation = isImageLandscape ? 'l' : 'p';
        } else {
            pdfOrientation = defaultOrientation.charAt(0); // 'p' or 'l'
        }

        // Set page dimensions based on the determined orientation
        if (pdfOrientation === 'l') {
            pageW = A4_HEIGHT; // Landscape: width > height
            pageH = A4_WIDTH;
        } else {
            pageW = A4_WIDTH; // Portrait: width < height
            pageH = A4_HEIGHT;
        }

        doc.addPage([pageW, pageH], pdfOrientation);

        // --- 2. Calculate Scaling and Positioning (Fit to Page) ---

        const maxPageW = pageW - 2 * MARGIN;
        const maxPageH = pageH - 2 * MARGIN;
        
        // Calculate the ratio to fit within the page margins
        const widthRatio = maxPageW / imgW;
        const heightRatio = maxPageH / imgH;
        
        // Use the smaller ratio to ensure the image fits entirely within the page
        const ratio = Math.min(widthRatio, heightRatio);
        
        const pdfW = imgW * ratio;
        const pdfH = imgH * ratio;

        // Center the image on the page
        const xPos = MARGIN + (maxPageW - pdfW) / 2;
        const yPos = MARGIN + (maxPageH - pdfH) / 2;

        // --- 3. Add Image to PDF ---
        
        // NOTE: jsPDF uses the mime-type implicitly. 
        // We use a blank string '' for mimeType here as the Data URL prefix defines it.
        // The compression/quality is handled by the canvas rendering internal to jsPDF, 
        // which uses the 'quality' parameter for JPEGs.
        
        // For efficiency, we use 'FAST' and the quality parameter.
        const imageType = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

        doc.addImage(
            dataUrl, 
            imageType, 
            xPos, 
            yPos, 
            pdfW, 
            pdfH, 
            null,       // Alias
            'FAST',     // Optimization
            0,          // Rotation
            quality     // Quality (0.1 to 1.0, only affects JPEGs)
        );
        
        // A small delay to allow UI to update (optional, but helps large batches)
        await new Promise(r => setTimeout(r, 10));
    }

    // --- 4. Finalize and Download ---
    
    updateConversionProgress(95, 'Finalizing and downloading...');

    // Generate a clean filename
    const filename = `converted_images_${Date.now()}.pdf`;
    
    // Save the PDF
    doc.save(filename);

    updateConversionProgress(100, '✅ Conversion Complete!');
    
    // Reset status after a short delay
    setTimeout(() => {
        resetConversionStatus();
    }, 3000);
}

// --- Event Listeners and Setup ---

document.addEventListener('DOMContentLoaded', () => {
    // Initialize drag-and-drop
    initSortable();
    
    // Set initial compression value display
    updateCompressionValue();
    
    // Ensure initial state is correct
    updateUIState();
});

// Main Event Listeners
uploadInput.addEventListener('change', handleFileSelect);
convertButton.addEventListener('click', convertImagesToPdf);
clearButton.addEventListener('click', clearAllImages);
compressionRange.addEventListener('input', updateCompressionValue);