import jsPDF from "jspdf";
import robotoRegular from "../../fonts/Roboto-Regular.js"; 

interface Personnel {
    role: string;
    count: number;
    workDetails: string;
}

interface Equipment {
    type: string;
    count: number;
    hours: number;
}

interface Material {
    name: string;
    quantity: number;
    unit: string;
}

interface Signature {
    data: string;
    signedBy: string;
    signedAt: string | Date;
    role?: string;
}

interface WorkLog {
    _id: string;
    date: string;
    project: string;
    projectName?: string;
    author: string;
    authorName?: string;
    weather?: string;
    temperature?: number;
    workDescription: string;
    personnel?: Personnel[];
    equipment?: Equipment[];
    materials?: Material[];
    notes?: string;
    signatures?: Signature[];
    images?: string[];
    createdAt?: string;
    updatedAt?: string;
}

async function fetchAsDataUrl(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

export async function exportToPDF(workLog: WorkLog) {
    const doc = new jsPDF();
    doc.addFileToVFS("Roboto-Regular.ttf", robotoRegular);
    doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    const lineGap = 8;
    let lastLineY = y;  // Keep track of the last Y position to draw the rectangle

    doc.setDrawColor(226, 232, 240); // Set light gray color for border
    const drawRect = () => {
        if (lastLineY < pageHeight - margin) {
            // Draw a rectangle that fits the content if it's on a single page
            doc.rect(margin, margin, pageWidth - 2 * margin, lastLineY - margin); // Adjust to content height
        } else {
            // Full page border if the content spans multiple pages
            doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin); // Full page border
        }
    };


    const addLine = (label?: string, value?: string | number) => {
        if (y + lineGap > pageHeight - margin) {
            drawRect();
            doc.addPage();
            y = margin + 10;
        }

        doc.setFontSize(10);
        doc.setFont("Roboto", "normal");
        doc.text(`${label ?? ""}`, margin + 6, y);
        doc.setFont("Roboto", "normal");
        doc.text(`${value ?? "N/A"}`, label ? margin + 40 : margin + 6, y);
        y += lineGap;
        lastLineY = y;
    };
    
    const addCardRow = (
        columns: Array<{ label?: string; value?: string | number }>
    ) => {
        const cardSidePadding = 8;      // small padding inside the card
        const colGap = 8;               // smaller gap between columns
        //const cardHeight = 20;          // reduced card height
    
        const cardX = margin + 4;       // small left margin
        const cardWidth = pageWidth - (margin + 4) * 2; // width minus small left/right padding
        const lineSpacing = 0.5;
    
        // Check page overflow
        /*if (y + cardHeight > pageHeight - margin) {
            drawRect();
            doc.addPage();
            y = margin + 10;
        }*/
    
       
    
        //const colWidth = (cardWidth - colGap * (columns.length - 1) - cardSidePadding * 2) / columns.length;
    
        //let x = cardX + cardSidePadding;

        let maxLines = 1;
        const wrappedValues: string[][] = [];
    
        columns.forEach(col => {
            const text = String(col.value ?? "N/A");
            doc.setFont("Roboto", "normal");
            doc.setFontSize(10);
            const colWidth = (cardWidth - colGap * (columns.length - 1) - cardSidePadding * 2) / columns.length;
            const lines = doc.splitTextToSize(text, colWidth);
            wrappedValues.push(lines);
            if (lines.length > maxLines) maxLines = lines.length;
        });

        const cardHeight = 14 + maxLines * (10 + lineSpacing); // 14 = space for label + padding

        // Check page overflow
        if (y + cardHeight > pageHeight - margin) {
            drawRect(); // draw rectangle for current page
            doc.addPage();
            y = margin + 10;
        }
        // Draw rounded rectangle for the card
        doc.setFillColor(249, 250, 251); 
        doc.roundedRect(cardX, y, cardWidth, cardHeight, 3, 3, "F");

        const colWidth = (cardWidth - colGap * (columns.length - 1) - cardSidePadding * 2) / columns.length;
        let x = cardX + cardSidePadding;
        
        columns.forEach((col, index) => {
            // Label
            doc.setFont("Roboto", "normal");
            doc.setFontSize(10);
            doc.setTextColor(120, 120, 120);
            doc.text((col.label ?? "").toUpperCase(), x, y + 6);

            // Wrapped value
            doc.setFont("Roboto", "normal");
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);

            const lines = wrappedValues[index];
            // Start value below label
            let valueY = y + 14;
            lines.forEach(line => {
                doc.text(line, x, valueY);
                valueY += 10 + lineSpacing; // font size + spacing
            });

            x += colWidth + colGap;
        });

        
    
        y += cardHeight + 4; // spacing between cards
        lastLineY = y;
    };

    const addHeader = (label: string) => {
        if (y + 4 * lineGap > pageHeight - margin) {
            drawRect();
            doc.addPage();
            y = margin + 10;
        }
        doc.setFontSize(14);
        y += lineGap;
        doc.setFont("Roboto", "bold");
        doc.text(`${label}`, margin + 6, y);
        y += 4;
        doc.line(margin + 6, y, pageWidth - 2 * margin +6, y);
        y += lineGap;
        lastLineY = y;
    };


    doc.setFontSize(18);
    doc.setFont("Roboto", "bold");
    doc.text("Work Log - " + new Date(workLog.date).toLocaleDateString(), margin + 6, y + 10)
    y += lineGap + 10;
    addLine("Created: ", workLog.createdAt ? new Date(workLog.createdAt).toLocaleString() : 'Unknown');



    // Basic Info
    addHeader("Basic Information")
    addLine("Date", new Date(workLog.date).toLocaleDateString());
    addLine("Project", workLog.projectName || workLog.project);
    addLine("Author", workLog.authorName || workLog.author);
    addLine("Weather", workLog.weather);
    addLine("Temperature", typeof workLog.temperature === "number" ? `${workLog.temperature}°C` : undefined);

    y += lineGap;

    // Work Description
    addHeader("Work Description")
    const workDescLines = doc.splitTextToSize(workLog.workDescription, 180);
    workDescLines.forEach((line: string) => {
        if (y + lineGap > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        addLine("",line);

    });


    // Personnel
    if (workLog.personnel?.length) {
        addHeader("Personnel");
        workLog.personnel.forEach(({ role, count, workDetails }) => {
            addCardRow([
                { label: "Role", value: role },
                { label: "Count", value: count },
                { label: "Work Details", value: workDetails }
            ]);
        });
    }

    // Equipment
    if (workLog.equipment?.length) {
        addHeader("Equipment");
        workLog.equipment.forEach(({ type, count, hours }) => {
            addCardRow([
                { label: "Type", value: type },
                { label: "Count", value: count },
                { label: "Hours", value: hours }
            ]);
        });
    }

    // Materials
    if (workLog.materials?.length) {
        addHeader("Materials");
        workLog.materials.forEach(({ name, quantity, unit }) => {
            addCardRow([
                { label: "Type", value: name },
                { label: "Quantity", value: quantity },
                { label: "Unit", value: unit }
            ]);
        });
    }

    // Notes
    if (workLog.notes) {
        addHeader("Notes");
        const notesLines = doc.splitTextToSize(workLog.notes, 180);
        notesLines.forEach((line: string) => {
            if (y + lineGap > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            addLine("",line)
        });
    }

    // Photos
    if (workLog.images && workLog.images.length > 0) {
        addHeader("Photos");
        const imgWidth = 80;
        const imgHeight = 60;
        const cols = 2;
        const colGap = 6;
        let col = 0;
        let rowStartY = y;

        for (const src of workLog.images) {
            if (col === 0 && rowStartY + imgHeight > pageHeight - margin) {
                drawRect();
                doc.addPage();
                y = margin + 10;
                rowStartY = y;
            }

            const x = margin + 6 + col * (imgWidth + colGap);
            try {
                const dataUrl = src.startsWith('data:') ? src : await fetchAsDataUrl(src);
                const format = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
                doc.setDrawColor(200, 200, 200);
                doc.rect(x, rowStartY, imgWidth, imgHeight);
                doc.addImage(dataUrl, format, x, rowStartY, imgWidth, imgHeight);
            } catch (err) {
                console.error('Error embedding photo:', err);
                doc.text('(Photo error)', x, rowStartY + 10);
            }

            col++;
            if (col >= cols) {
                col = 0;
                rowStartY += imgHeight + lineGap;
                y = rowStartY;
                lastLineY = y;
            }
        }
        if (col !== 0) {
            y = rowStartY + imgHeight + lineGap;
            lastLineY = y;
        }
    }

    // Signatures
    if (workLog.signatures && workLog.signatures.length > 0) {
        addHeader("Signatures");

        workLog.signatures.forEach((signature, index) => {
            // Check if we need a new page for the signature
            if (y + 50 > pageHeight - margin) {
                drawRect();
                doc.addPage();
                y = margin + 10;
            }

            // Signature info
            doc.setFontSize(10);
            doc.setFont("Helvetica", "bold");
            doc.text(`Signed by: ${signature.signedBy}`, margin + 6, y);
            y += lineGap;

            if (signature.role) {
                doc.setFont("Helvetica", "normal");
                doc.text(`Role: ${signature.role}`, margin + 6, y);
                y += lineGap;
            }

            doc.setFont("Helvetica", "normal");
            doc.text(
                `Date: ${new Date(signature.signedAt).toLocaleString()}`,
                margin + 6,
                y
            );
            y += lineGap + 2;

            // Add signature image
            try {
                const imgWidth = 60;
                const imgHeight = 30;

                // Draw a border around the signature
                doc.setDrawColor(200, 200, 200);
                doc.rect(margin + 6, y, imgWidth, imgHeight);

                // Add the signature image
                doc.addImage(
                    signature.data,
                    'PNG',
                    margin + 6,
                    y,
                    imgWidth,
                    imgHeight
                );

                y += imgHeight + lineGap * 2;
                lastLineY = y;
            } catch (error) {
                console.error('Error adding signature image:', error);
                doc.text('(Signature image error)', margin + 6, y);
                y += lineGap * 2;
            }

            // Add separator between signatures
            if (workLog.signatures && index < workLog.signatures.length - 1) {
                y += lineGap;
            }
        });
    }

    drawRect();
    doc.save(`WorkLog-${new Date(workLog.date).toISOString().split("T")[0]}.pdf`);
}
