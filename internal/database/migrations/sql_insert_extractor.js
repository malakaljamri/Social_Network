// SQL INSERT Command Extractor
// Run this script in browser console to separate commands from SQL scripts

(function() {
    // Create container
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        background: white;
        border: 2px solid #333;
        border-radius: 8px;
        padding: 15px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: 'Courier New', monospace;
        font-size: 12px;
    `;

    // Create title
    const title = document.createElement('h3');
    title.textContent = 'SQL INSERT Extractor';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #333;
        font-size: 14px;
        text-align: center;
    `;
    container.appendChild(title);

    // Create input label
    const inputLabel = document.createElement('label');
    inputLabel.textContent = 'Paste SQL Script:';
    inputLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
        color: #555;
    `;
    container.appendChild(inputLabel);

    // Create input textarea
    const inputTextarea = document.createElement('textarea');
    inputTextarea.style.cssText = `
        width: 100%;
        height: 150px;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        resize: vertical;
        box-sizing: border-box;
    `;
    inputTextarea.placeholder = 'Paste your SQL script here...';
    container.appendChild(inputTextarea);

    // Create extract button
    const extractButton = document.createElement('button');
    extractButton.textContent = 'Extract INSERT Commands';
    extractButton.style.cssText = `
        width: 100%;
        margin: 10px 0;
        padding: 8px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
    `;
    extractButton.onmouseover = () => extractButton.style.background = '#0056b3';
    extractButton.onmouseout = () => extractButton.style.background = '#007bff';
    container.appendChild(extractButton);

    // Create output label
    const outputLabel = document.createElement('label');
    outputLabel.textContent = 'INSERT Commands:';
    outputLabel.style.cssText = `
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
        color: #555;
    `;
    container.appendChild(outputLabel);

    // Create output textarea
    const outputTextarea = document.createElement('textarea');
    outputTextarea.style.cssText = `
        width: 100%;
        height: 200px;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        resize: vertical;
        box-sizing: border-box;
        background: #f8f9fa;
    `;
    outputTextarea.placeholder = 'Extracted INSERT commands will appear here...';
    outputTextarea.readOnly = true;
    container.appendChild(outputTextarea);

    // Create copy button for INSERT commands
    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy to Clipboard';
    copyButton.style.cssText = `
        width: 100%;
        margin-top: 10px;
        padding: 8px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
    `;
    copyButton.onmouseover = () => copyButton.style.background = '#1e7e34';
    copyButton.onmouseout = () => copyButton.style.background = '#28a745';
    container.appendChild(copyButton);

    // --- Add label and textarea for non-INSERT commands ---
    const nonInsertLabel = document.createElement('label');
    nonInsertLabel.textContent = 'Other (Non-INSERT) Commands:';
    nonInsertLabel.style.cssText = `
        display: block;
        margin: 10px 0 5px 0;
        font-weight: bold;
        color: #555;
    `;
    container.appendChild(nonInsertLabel);

    const nonInsertTextarea = document.createElement('textarea');
    nonInsertTextarea.style.cssText = `
        width: 100%;
        height: 200px;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 8px;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        resize: vertical;
        box-sizing: border-box;
        background: #f8f9fa;
    `;
    nonInsertTextarea.placeholder = 'Other (non-INSERT) SQL commands will appear here...';
    nonInsertTextarea.readOnly = true;
    container.appendChild(nonInsertTextarea);

    // Copy button for non-INSERT commands
    const copyNonInsertButton = document.createElement('button');
    copyNonInsertButton.textContent = 'Copy Other Commands';
    copyNonInsertButton.style.cssText = `
        width: 100%;
        margin-top: 10px;
        padding: 8px;
        background: #ffc107;
        color: #333;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
    `;
    copyNonInsertButton.onmouseover = () => copyNonInsertButton.style.background = '#e0a800';
    copyNonInsertButton.onmouseout = () => copyNonInsertButton.style.background = '#ffc107';
    container.appendChild(copyNonInsertButton);

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 10px;
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        line-height: 1;
    `;
    closeButton.onclick = () => document.body.removeChild(container);
    container.appendChild(closeButton);

    // Extract function
    function extractInsertCommands(sqlText) {
        const lines = sqlText.split('\n');
        const insertCommands = [];
        
        for (let line of lines) {
            line = line.trim();
            if (line.toUpperCase().startsWith('INSERT INTO')) {
                insertCommands.push(line);
            }
        }
        
        return insertCommands.join('\n');
    }

    // Extract non-INSERT commands, preserving order
    function extractNonInsertCommands(sqlText) {
        const lines = sqlText.split('\n');
        const nonInsertCommands = [];
        
        for (let line of lines) {
            if (!line.trim().toUpperCase().startsWith('INSERT INTO')) {
                nonInsertCommands.push(line);
            }
        }
        
        return nonInsertCommands.join('\n');
    }

    // Button click handlers
    extractButton.onclick = () => {
        const sqlText = inputTextarea.value;
        if (!sqlText.trim()) {
            alert('Please paste a SQL script first!');
            return;
        }
        
        const insertCommands = extractInsertCommands(sqlText);
        outputTextarea.value = insertCommands;
        const nonInsertCommands = extractNonInsertCommands(sqlText);
        nonInsertTextarea.value = nonInsertCommands;
        
        if (insertCommands) {
            outputTextarea.style.background = '#d4edda';
            setTimeout(() => {
                outputTextarea.style.background = '#f8f9fa';
            }, 1000);
        } else {
            outputTextarea.value = 'No INSERT commands found in the provided SQL script.';
            outputTextarea.style.background = '#f8d7da';
        }
        if (nonInsertCommands) {
            nonInsertTextarea.style.background = '#fff3cd';
            setTimeout(() => {
                nonInsertTextarea.style.background = '#f8f9fa';
            }, 1000);
        } else {
            nonInsertTextarea.value = 'No non-INSERT commands found in the provided SQL script.';
            nonInsertTextarea.style.background = '#f8d7da';
        }
    };

    copyButton.onclick = () => {
        if (!outputTextarea.value.trim()) {
            alert('No INSERT commands to copy!');
            return;
        }
        
        outputTextarea.select();
        document.execCommand('copy');
        
        // Visual feedback
        const originalText = copyButton.textContent;
        copyButton.textContent = 'Copied!';
        copyButton.style.background = '#6c757d';
        
        setTimeout(() => {
            copyButton.textContent = originalText;
            copyButton.style.background = '#28a745';
        }, 1000);
    };

    copyNonInsertButton.onclick = () => {
        if (!nonInsertTextarea.value.trim()) {
            alert('No non-INSERT commands to copy!');
            return;
        }
        
        nonInsertTextarea.select();
        document.execCommand('copy');
        
        // Visual feedback
        const originalText = copyNonInsertButton.textContent;
        copyNonInsertButton.textContent = 'Copied!';
        copyNonInsertButton.style.background = '#6c757d';
        
        setTimeout(() => {
            copyNonInsertButton.textContent = originalText;
            copyNonInsertButton.style.background = '#ffc107';
        }, 1000);
    };

    // Add to page
    document.body.appendChild(container);
    
    // Focus on input
    inputTextarea.focus();
    
    console.log('SQL INSERT Extractor loaded! Paste your SQL script and click "Extract INSERT Commands".');
})(); 