// ==UserScript==
// @name         eTicketBot PRO (Async-Turbo + Auto-Reload)
// @namespace    http://tampermonkey.net/
// @version      1.0.1.7
// @description  Automatic Ticket Booking Script with Bogie-Failure Reload
// @author       Jakir Hossain / Gemini
// @match        https://eticket.railway.gov.bd/booking/train/search*
// @icon         https://eticket.railway.gov.bd/favicon.ico
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const tripName = "PADMA EXPRESS (760)";
    const seatClass = "SNIGDHA";
    const isDhakaToRajshahi = true;
    const maxSeats = 4;
    const maxBogieTries = 3; // Number of tries before reloading

    // Helper: Sleep/Delay
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Preferable seats configuration
    const preferableSeats = [
        ["54", "55", "59", "60", "64", "65", "69", "70", "49", "50", "51", "52", "53", "56", "57", "58", "61", "62", "63", "66", "67", "68", "46", "47", "48", "29", "30", "24", "25", "19", "20", "14", "15", "34", "35", "9", "10", "26", "27", "28", "21", "22", "23", "16", "17", "18", "11", "12", "13", "31", "32", "33", "6", "7", "8", "79", "80", "4", "5", "39", "40", "44", "45", "76", "77", "78", "1", "2", "3", "36", "37", "38", "41", "42", "43"],
        ["29", "30", "24", "25", "19", "20", "14", "15", "34", "35", "9", "10", "26", "27", "28", "21", "22", "23", "16", "17", "18", "11", "12", "13", "31", "32", "33", "6", "7", "8", "54", "55", "59", "60", "64", "65", "69", "70", "49", "50", "74", "75", "51", "52", "53", "56", "57", "58", "61", "62", "63", "66", "67", "68", "46", "47", "48", "71", "72", "73", "4", "5", "1", "2", "3", "79", "80", "76", "77", "78", "39", "40", "36", "37", "38", "44", "45", "41", "42", "43"]
    ];

    function getPreferableSeats() {
        return isDhakaToRajshahi ? preferableSeats[0] : preferableSeats[1];
    }

    function extractSeatNumber(title) {
        const match = title.match(/-(\d+)$/);
        return match ? match[1] : null;
    }

    function hideSwal() {
        const swal2 = document.querySelector('.swal2-container');
        if (swal2) swal2.style.display = 'none';
    }

    async function waitForSeatSelection(seatTitle, timeout = 3000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const btn = document.querySelector(`button[title="${seatTitle}"]`);
            if (!btn) return "NOT_FOUND";
            if (btn.classList.contains('seat-selected')) return "SUCCESS";
            if (!btn.classList.contains('seat-available')) return "TAKEN";
            await sleep(50);
        }
        return "TIMEOUT";
    }

    async function startBooking() {
        console.log("=== eTicketBot PRO Started ===");

        // 1. Find Trip
        let tripElement = null;
        while (!tripElement) {
            const titles = document.querySelectorAll('h2[style="text-transform: uppercase;"]');
            for (let t of titles) {
                if (t.textContent.trim() === tripName) {
                    tripElement = t.closest('app-single-trip');
                    break;
                }
            }
            if (!tripElement) {
                console.log("Waiting for Trip...");
                await sleep(300);
            }
        }
        console.log("✓ Trip found");

        // 2. Find Seat Class & Click Book Now
        let seatClassContainer = null;
        while (!seatClassContainer) {
            const classes = tripElement.querySelectorAll('.seat-class-name');
            for (let c of classes) {
                if (c.textContent.trim() === seatClass) {
                    seatClassContainer = c.closest('.single-seat-class');
                    break;
                }
            }
            if (!seatClassContainer) {
                console.log("Waiting for Seat Class...");
                await sleep(300);
            }
        }

        const bookBtn = seatClassContainer.querySelector('.book-now-btn');
        if (bookBtn) bookBtn.click();
        console.log("✓ Book Now clicked");

        // 3. Select Bogie (With Reload Feature)
        let selectElement = null;
        let bogieTries = 0;

        while (!selectElement || selectElement.options.length === 0) {
            selectElement = document.querySelector('#select-bogie');

            if (!selectElement || selectElement.options.length === 0) {
                bogieTries++;
                console.log(`Bogie not found. Try: ${bogieTries}/${maxBogieTries}`);

                if (bogieTries >= maxBogieTries) {
                    console.log("Bogie limit reached. Reloading page...");
                    window.location.reload();
                    return; // Stop execution of current instance
                }

                await sleep(1000); // Wait 1 second before next try
            }
        }

        const options = Array.from(selectElement.options)
            .map(o => ({
                value: o.value,
                text: o.textContent,
                count: parseInt(o.textContent.match(/(\d+)/)?.[0] || 0)
            }))
            .sort((a, b) => b.count - a.count);

        if (options.length > 0 && options[0].count > 0) {
            selectElement.value = options[0].value;
            selectElement.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`✓ Bogie selected: ${options[0].text}`);
        } else {
            console.log("No available seats in any bogie. Reloading...");
            window.location.reload();
            return;
        }

        // 4. Seat Selection Loop
        await performSeatSelection();
    }

    async function performSeatSelection() {
        const prefOrder = getPreferableSeats();
        const processed = new Set();
        let selectedCount = 0;

        while (selectedCount < maxSeats) {
            hideSwal();
            const seatLayout = document.querySelector('.seat_layout');
            if (!seatLayout) {
                await sleep(300);
                continue;
            }

            const available = Array.from(seatLayout.querySelectorAll('button.seat-available'))
                .filter(btn => !processed.has(btn.title));

            if (available.length === 0) {
                console.log("No more available seats. Finishing.");
                break;
            }

            available.sort((a, b) => {
                const idxA = prefOrder.indexOf(extractSeatNumber(a.title));
                const idxB = prefOrder.indexOf(extractSeatNumber(b.title));
                const rankA = idxA === -1 ? 999 : idxA;
                const rankB = idxB === -1 ? 999 : idxB;
                return rankA - rankB;
            });

            const target = available[0];
            const title = target.title;
            processed.add(title);

            console.log(`Attempting Seat: ${title}`);
            target.click();

            const result = await waitForSeatSelection(title);

            if (result === "SUCCESS") {
                selectedCount++;
                console.log(`>> ✓ CONFIRMED: ${title} [${selectedCount}/${maxSeats}]`);
            } else {
                console.log(`>> ✗ FAILED/SKIP: ${title} (${result})`);
            }

            await sleep(100);
        }
        console.log("=== Script Task Finished ===");
    }

    startBooking();
})();
