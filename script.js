// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBjY-pE5jxQJgKqDZrcE7Im66_5r-X_mRA",
  authDomain: "setup-login-page.firebaseapp.com",
  projectId: "setup-login-page",
  storageBucket: "setup-login-page.appspot.com",
  messagingSenderId: "341251531099",
  appId: "1:341251531099:web:f4263621455541ffdc3a7e",
  measurementId: "G-ZXFC7NR9HV"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Initialize jsPDF
const { jsPDF } = window.jspdf;

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const originalTextEl = document.getElementById('originalText');
  const userTextEl = document.getElementById('userText');
  const compareBtn = document.getElementById('compareBtn');
  const showFullTextBtn = document.getElementById('showFullTextBtn');
  const backToResultsBtn = document.getElementById('backToResultsBtn');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const closeResultsBtn = document.getElementById('closeResultsBtn');
  const resultsSection = document.getElementById('results');
  const fullTextSection = document.getElementById('fullTextSection');
  const comparisonResultEl = document.getElementById('comparisonResult');
  const statsEl = document.getElementById('stats');
  const feedbackEl = document.getElementById('feedback');
  const originalDisplayEl = document.getElementById('originalDisplay');
  const userDisplayEl = document.getElementById('userDisplay');
  const resultDateEl = document.getElementById('resultDate');
  const originalTextGroup = document.getElementById('originalTextGroup');
  const timerOptions = document.getElementById('timerOptions');
  const timerDisplay = document.getElementById('timerDisplay');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('userInfo');
  const userPhoto = document.getElementById('userPhoto');
  const userName = document.getElementById('userName');
  const loginPrompt = document.getElementById('loginPrompt');
  const customTestSection = document.getElementById('customTestSection');
  const globalTestsSection = document.getElementById('globalTestsSection');
  const globalTestsList = document.getElementById('globalTestsList');
  const leaderboardSection = document.getElementById('leaderboardSection');
  const leaderboardList = document.getElementById('leaderboardList');
  const leaderboardFilter = document.getElementById('leaderboardFilter');
  const testNameFilter = document.getElementById('testNameFilter');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const leaderboardPagination = document.getElementById('leaderboardPagination');

  // Custom Test Logic
  const saveBtn = document.getElementById('saveTestBtn');
  const clearBtn = document.getElementById('clearTestsBtn');
  const customTitle = document.getElementById('customTitle');
  const customOriginal = document.getElementById('customOriginal');

  // Timer variables
  let timerInterval;
  let endTime;
  let testActive = false;
  let timerButtons = document.querySelectorAll('.timer-option');
  
  // Leaderboard pagination variables
  let currentPage = 1;
  const entriesPerPage = 10;
  let allAttempts = [];
  let filteredAttempts = [];
  let uniqueTestNames = new Set();

  // Initialize typing timer
  let startTime = null;
  userTextEl.addEventListener('input', function() {
    if (!startTime) {
      startTime = new Date();
    }
  });

  // Auth state listener
  auth.onAuthStateChanged(user => {
    if (user) {
      // User is signed in
      loginBtn.classList.add('hidden');
      userInfo.classList.remove('hidden');
      userPhoto.src = user.photoURL;
      userName.textContent = user.displayName;
      loginPrompt.classList.add('hidden');
      customTestSection.classList.remove('hidden');
      globalTestsSection.classList.remove('hidden');
      leaderboardSection.classList.remove('hidden');
      loadGlobalTests();
      loadLeaderboard();
      cleanupOldData(); // Run cleanup when user logs in
    } else {
      // User is signed out
      loginBtn.classList.remove('hidden');
      userInfo.classList.add('hidden');
      loginPrompt.classList.remove('hidden');
      customTestSection.classList.add('hidden');
      globalTestsSection.classList.add('hidden');
      leaderboardSection.classList.add('hidden');
    }
  });

  // Login handler
  loginBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .catch(error => {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
      });
  });

  // Logout handler
  logoutBtn.addEventListener('click', () => {
    auth.signOut();
  });

  // Leaderboard filter change handler
  leaderboardFilter.addEventListener('change', () => {
    currentPage = 1;
    loadLeaderboard();
  });

  // Test name filter change handler
  testNameFilter.addEventListener('change', () => {
    currentPage = 1;
    loadLeaderboard();
  });

  // Pagination button handlers
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      updatePagination();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredAttempts.length / entriesPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      updatePagination();
    }
  });

  // Load leaderboard data with pagination
  function loadLeaderboard() {
    const filter = leaderboardFilter.value;
    let query = database.ref('attempts').orderByChild('timestamp');
    
    if (filter === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      query = query.startAt(oneWeekAgo.getTime());
    } else if (filter === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      query = query.startAt(oneMonthAgo.getTime());
    }

    query.once('value')
      .then(snapshot => {
        const attempts = snapshot.val();
        if (!attempts) {
          leaderboardList.innerHTML = '<p>No attempts recorded yet. Be the first to complete a test!</p>';
          leaderboardPagination.innerHTML = '';
          return;
        }

        // Convert to array and sort by accuracy (descending)
        allAttempts = Object.entries(attempts).map(([id, attempt]) => ({
          id,
          ...attempt
        }));
        
        allAttempts.sort((a, b) => b.stats.accuracy - a.stats.accuracy);
        
        // Update test name filter options
        updateTestNameFilter(allAttempts);
        
        // Filter by test name if selected
        filteredAttempts = testNameFilter.value === 'all' 
          ? allAttempts 
          : allAttempts.filter(attempt => attempt.testTitle === testNameFilter.value);
          
        // Update pagination
        updatePagination();
      })
      .catch(error => {
        console.error('Error loading leaderboard:', error);
        leaderboardList.innerHTML = '<p>Error loading leaderboard. Please try again later.</p>';
        leaderboardPagination.innerHTML = '';
      });
  }

  function updateTestNameFilter(attempts) {
    uniqueTestNames = new Set(attempts.map(attempt => attempt.testTitle || 'Custom Test'));
    const currentTestFilter = testNameFilter.value;
    
    testNameFilter.innerHTML = '<option value="all">All Tests</option>';
    uniqueTestNames.forEach(testName => {
      const option = document.createElement('option');
      option.value = testName;
      option.textContent = testName;
      testNameFilter.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentTestFilter !== 'all' && uniqueTestNames.has(currentTestFilter)) {
      testNameFilter.value = currentTestFilter;
    } else {
      testNameFilter.value = 'all';
    }
  }

  function updatePagination() {
    const totalPages = Math.ceil(filteredAttempts.length / entriesPerPage);
    const startIdx = (currentPage - 1) * entriesPerPage;
    const endIdx = startIdx + entriesPerPage;
    const pageAttempts = filteredAttempts.slice(startIdx, endIdx);
    
    // Update buttons
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    
    // Update pagination info
    leaderboardPagination.innerHTML = `Showing ${startIdx + 1}-${Math.min(endIdx, filteredAttempts.length)} of ${filteredAttempts.length} entries`;
    
    // Build leaderboard table
    renderLeaderboardTable(pageAttempts, startIdx + 1);
  }

  function renderLeaderboardTable(attempts, startRank) {
    if (attempts.length === 0) {
      leaderboardList.innerHTML = '<p>No attempts match your filters.</p>';
      return;
    }

    let tableHTML = `
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>User</th>
            <th>Test</th>
            <th>Accuracy</th>
            <th>Speed (WPM)</th>
            <th>Words</th>
            <th>Half Mistakes</th>
            <th>Full Mistakes</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
    `;

    attempts.forEach((attempt, index) => {
      const date = new Date(attempt.timestamp);
      const accuracyClass = 
        attempt.stats.accuracy >= 90 ? 'accuracy-high' :
        attempt.stats.accuracy >= 70 ? 'accuracy-medium' : 'accuracy-low';

      tableHTML += `
        <tr>
          <td>${startRank + index}</td>
          <td class="leaderboard-user">
            <img src="${attempt.userPhoto}" alt="${attempt.userName}">
            <span>${attempt.userName}</span>
          </td>
          <td>${attempt.testTitle || 'Custom Test'}</td>
          <td class="accuracy-cell ${accuracyClass}">${attempt.stats.accuracy.toFixed(1)}%</td>
          <td>${attempt.stats.wpm}</td>
          <td>${attempt.stats.totalUser}</td>
          <td>${attempt.stats.halfMistakes}</td>
          <td>${attempt.stats.fullMistakes}</td>
          <td>${date.toLocaleDateString()}</td>
        </tr>
      `;
    });

    tableHTML += `</tbody></table>`;
    leaderboardList.innerHTML = tableHTML;
  }

  // Auto-delete old data function
  function cleanupOldData() {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const timestampThreshold = threeMonthsAgo.getTime();

    // Cleanup old attempts
    database.ref('attempts').once('value').then(snapshot => {
      const updates = {};
      snapshot.forEach(child => {
        if (child.val().timestamp < timestampThreshold) {
          updates[child.key] = null;
        }
      });
      if (Object.keys(updates).length > 0) {
        database.ref('attempts').update(updates)
          .then(() => console.log('Old attempts cleaned up'))
          .catch(error => console.error('Error cleaning up attempts:', error));
      }
    });

    // Cleanup old tests
    database.ref('tests').once('value').then(snapshot => {
      const updates = {};
      snapshot.forEach(child => {
        if (child.val().timestamp < timestampThreshold) {
          updates[child.key] = null;
        }
      });
      if (Object.keys(updates).length > 0) {
        database.ref('tests').update(updates)
          .then(() => console.log('Old tests cleaned up'))
          .catch(error => console.error('Error cleaning up tests:', error));
      }
    });
  }

  // Run cleanup weekly
  setInterval(cleanupOldData, 7 * 24 * 60 * 60 * 1000);

  // Original text paste handler
  originalTextEl.addEventListener('paste', function() {
    // Clear any selected test card
    document.querySelectorAll('.test-card').forEach(card => {
      card.classList.remove('selected');
    });
    
    setTimeout(() => {
      if (originalTextEl.value.trim() !== '' && !testActive) {
        originalTextGroup.classList.add('hidden');
        timerOptions.classList.remove('hidden');
        timerButtons.forEach(btn => {
          btn.disabled = false;
          btn.style.opacity = '1';
        });
      }
    }, 0);
  });
  
  // Timer option click handler
  timerButtons.forEach(button => {
    button.addEventListener('click', function() {
      const minutes = parseInt(this.dataset.minutes);
      startTimer(minutes);
      timerOptions.classList.add('hidden');
      timerDisplay.classList.remove('hidden');
      testActive = true;
    });
  });
  
  // Compare button click handler
  compareBtn.addEventListener('click', function() {
    stopTimer();
    compareTexts();
    disableTimerOptions();
  });
  
  // Show full text button click handler
  showFullTextBtn.addEventListener('click', showFullTexts);
  
  // Back to results button click handler
  backToResultsBtn.addEventListener('click', showResults);
  
  // Download PDF button click handler
  downloadPdfBtn.addEventListener('click', downloadAsPdf);
  
  // Close results button click handler
  closeResultsBtn.addEventListener('click', function() {
    location.reload();
  });
  
  function startTimer(minutes) {
    endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + minutes);
    
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
      updateTimerDisplay();
      
      const now = new Date();
      if (now >= endTime) {
        stopTimer();
        timerDisplay.classList.add('timer-ended');
        timerDisplay.textContent = "TIME'S UP!";
        compareTexts();
        lockTest();
        disableTimerOptions();
      }
    }, 1000);
  }
  
  function stopTimer() {
    clearInterval(timerInterval);
    timerDisplay.classList.add('hidden');
  }
  
  function disableTimerOptions() {
    timerButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    });
  }
  
  function updateTimerDisplay() {
    const now = new Date();
    const remaining = endTime - now;
    
    if (remaining <= 0) return;
    
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  function lockTest() {
    userTextEl.readOnly = true;
    userTextEl.classList.add('locked-textarea');
    compareBtn.disabled = true;
    closeResultsBtn.classList.remove('hidden');
  }
  
  function compareTexts() {
    const originalText = originalTextEl.value;
    const userText = userTextEl.value;
    
    if (!originalText || !userText) {
      alert('Please enter both original text and your transcription.');
      return;
    }
    
    // Get the test title (either from the selected test card or use "Custom Test")
    let testTitle = "Custom Test";
    const selectedTestCard = document.querySelector('.test-card.selected');
    if (selectedTestCard) {
        testTitle = selectedTestCard.querySelector('h4').textContent;
    }
    
    // Process texts
    const originalWords = processText(originalText);
    const userWords = processText(userText);
    
    // Compare words
    const comparison = compareParagraphs(originalWords, userWords);
    
    // Display results
    displayComparison(comparison);
    displayStats(comparison.stats);
    displayFeedback(comparison.stats, originalWords, userWords);
    displayFullTexts(originalText, userText);
    
    // Set current date and time
    const now = new Date();
    resultDateEl.textContent = now.toLocaleString();
    
    // Show results section
    showResults();
    
    // Lock the test if timer ended or compare was clicked manually
    if (testActive) {
      lockTest();
    }

    // Save attempt to leaderboard if user is logged in
    const user = auth.currentUser;
    if (user) {
      const attemptData = {
        userName: user.displayName,
        userPhoto: user.photoURL,
        testTitle: testTitle,  // Use the determined test title
        stats: comparison.stats,
        timestamp: Date.now()
      };

      database.ref('attempts').push(attemptData)
        .then(() => loadLeaderboard())
        .catch(error => console.error('Error saving attempt:', error));
    }
  }
  
  function showFullTexts() {
    resultsSection.classList.add('hidden');
    fullTextSection.classList.remove('hidden');
  }
  
  function showResults() {
    fullTextSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
  }
  
  function downloadAsPdf() {
    const resultsElement = document.getElementById('results');

    html2canvas(resultsElement, {
      scale: 1.5,
      useCORS: true,
      allowTaint: true
    }).then(canvas => {
      const imgData = canvas.toDataURL('image/jpeg', 0.7);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('transcription-comparison.pdf');
    });
  }
  
  function processText(text) {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .trim()
      .split(/\s+/);
  }
  
  function isSimilar(wordA, wordB) {
    const minLength = Math.min(wordA.length, wordB.length);
    const maxLength = Math.max(wordA.length, wordB.length);
    let similarCount = 0;
    const threshold = 50;
    
    for (let i = 0; i < minLength; i++) {
      if (wordA[i] === wordB[i]) {
        similarCount++;
      }
    }
    
    const similarityPercentage = (similarCount / maxLength) * 100;
    return similarityPercentage >= threshold;
  }
  
  function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) return false;
    }
    return true;
  }
  
  function compareParagraphs(paragraphA, paragraphB) {
    let comparedText = '';
    let numHalfDiff = 0;
    let numFullDiff = 0;
    let wordAIndex = 0;
    let wordBIndex = 0;

    while (wordAIndex < paragraphA.length || wordBIndex < paragraphB.length) {
      const wordA = paragraphA[wordAIndex] || '';
      const wordB = paragraphB[wordBIndex] || '';
      const cleanWordA = wordA.replace(/[,\?\-\s]/g, '');
      const cleanWordB = wordB.replace(/[,\?\-\s]/g, '');

      if (cleanWordA === cleanWordB) {
        comparedText += `<span class="correct">${wordA}</span> `;
        wordAIndex++;
        wordBIndex++;
      } else if (cleanWordA.toLowerCase() === cleanWordB.toLowerCase()) {
        comparedText += `<span class="capitalization">${wordA}</span> `;
        comparedText += `<span class="capitalization-strike">${wordB}</span> `;
        wordAIndex++;
        wordBIndex++;
        numHalfDiff++;
      } else {
        if (!wordA) {
          comparedText += `<span class="addition">${wordB}</span> `;
          wordBIndex++;
          numFullDiff++;
        } else if (!wordB) {
          comparedText += `<span class="missing">${wordA}</span> `;
          wordAIndex++;
          numFullDiff++;
        } else {
          if (wordA === paragraphB[wordBIndex]) {
            comparedText += `<span class="spelling">${wordA}</span> `;
            wordAIndex++;
            wordBIndex++;
          } else if (wordB === paragraphA[wordAIndex]) {
            comparedText += `<span class="spelling-strike">${wordB}</span> `;
            wordAIndex++;
            wordBIndex++;
          } else if (isSimilar(wordA, wordB)) {
            comparedText += `<span class="spelling">${wordA}</span> `;
            comparedText += `<span class="spelling-strike">${wordB}</span> `;
            wordAIndex++;
            wordBIndex++;
            numHalfDiff++;
          } else {
            const pairA = [wordA];
            const pairB = [wordB];
            
            for (let i = 1; i < 5 && (wordBIndex + i) < paragraphB.length; i++) {
              pairB.push(paragraphB[wordBIndex + i]);
            }
            
            for (let i = 1; i < 5 && (wordAIndex + i) < paragraphA.length; i++) {
              pairA.push(paragraphA[wordAIndex + i]);
            }

            let foundPairInA = false;
            for (let i = 1; i <= 50 && (wordAIndex + i) < paragraphA.length; i++) {
              const subarrayA = paragraphA.slice(wordAIndex + i, wordAIndex + i + pairB.length);
              if (arraysAreEqual(subarrayA, pairB)) {
                for (let j = 0; j < i; j++) {
                  comparedText += `<span class="missing">${paragraphA[wordAIndex + j]}</span> `;
                  numFullDiff++;
                }
                comparedText += `<span class="correct">${pairB.join(' ')}</span> `;
                wordAIndex += i + pairB.length;
                wordBIndex += pairB.length;
                foundPairInA = true;
                break;
              }
            }

            if (!foundPairInA) {
              let foundPairInB = false;
              for (let i = 1; i <= 50 && (wordBIndex + i) < paragraphB.length; i++) {
                const subarrayB = paragraphB.slice(wordBIndex + i, wordBIndex + i + pairA.length);
                if (arraysAreEqual(subarrayB, pairA)) {
                  for (let j = 0; j < i; j++) {
                    comparedText += `<span class="addition">${paragraphB[wordBIndex + j]}</span> `;
                    numFullDiff++;
                  }
                  comparedText += `<span class="correct">${pairA.join(' ')}</span> `;
                  wordAIndex += pairA.length;
                  wordBIndex += i + pairA.length;
                  foundPairInB = true;
                  break;
                }
              }

              if (!foundPairInB) {
                comparedText += `<span class="missing">${wordA}</span> `;
                comparedText += `<span class="addition">${wordB}</span> `;
                wordAIndex++;
                wordBIndex++;
                numFullDiff++;
              }
            }
          }
        }
      }
    }

    // Calculate statistics
    const keystrokesCount = userTextEl.value.length;
    const errorPercentage = paragraphA.length > 0 ? 
      Math.min(100, ((numHalfDiff / 2) + numFullDiff) / paragraphA.length * 100) : 0;
    const accuracyPercentage = Math.max(0, 100 - errorPercentage);
    
    // Calculate WPM
    const endTime = new Date();
    const typingTimeSeconds = startTime ? (endTime - startTime) / 1000 : 60;
    const typingTimeMinutes = typingTimeSeconds / 60;
    const wordsTyped = paragraphB.length;
    const wpm = typingTimeMinutes > 0 ? Math.round(wordsTyped / typingTimeMinutes) : 0;

    return {
      html: comparedText,
      stats: {
        totalOriginal: paragraphA.length,
        totalUser: paragraphB.length,
        halfMistakes: numHalfDiff,
        fullMistakes: numFullDiff,
        keystrokes: keystrokesCount,
        wpm: wpm,
        accuracy: accuracyPercentage,
        errorRate: errorPercentage
      }
    };
  }
  
  function displayComparison(comparison) {
    comparisonResultEl.innerHTML = comparison.html;
  }
  
  function displayStats(stats) {
    statsEl.innerHTML = `
      <div class="stat-item">
        <h4>Original Words</h4>
        <p>${stats.totalOriginal}</p>
      </div>
      <div class="stat-item">
        <h4>Your Words</h4>
        <p>${stats.totalUser}</p>
      </div>
      <div class="stat-item">
        <h4>Half Mistakes</h4>
        <p>${stats.halfMistakes}</p>
      </div>
      <div class="stat-item">
        <h4>Full Mistakes</h4>
        <p>${stats.fullMistakes}</p>
      </div>
      <div class="stat-item">
        <h4>Keystrokes</h4>
        <p>${stats.keystrokes}</p>
      </div>
      <div class="stat-item">
        <h4>Typing Speed (WPM)</h4>
        <p>${stats.wpm}</p>
      </div>
      <div class="stat-item">
        <h4>Accuracy</h4>
        <p>${stats.accuracy.toFixed(1)}%</p>
      </div>
    `;
  }
  
  function displayFeedback(stats, originalWords, userWords) {
    const analysis = analyzeMistakes(originalWords, userWords);
    
    let feedback = `
      <h4>Overall Assessment</h4>
      ${getOverallAssessment(stats.accuracy, stats.wpm)}
      
      <h4>Mistake Analysis</h4>
      <ul>
        ${analysis.commonMistakes.map(m => `<li>${m}</li>`).join('')}
      </ul>
      
      <h4>Improvement Suggestions</h4>
      <ul>
        ${getImprovementSuggestions(analysis, stats)}
      </ul>
    `;
    
    feedbackEl.innerHTML = feedback;
  }
  
  function displayFullTexts(original, user) {
    originalDisplayEl.textContent = original;
    userDisplayEl.textContent = user;
  }
  
  function analyzeMistakes(originalText, userText) {
    const analysis = {
      commonMistakes: [],
      omissionRate: 0,
      additionRate: 0,
      spellingErrorRate: 0,
      capitalizationErrorRate: 0,
      mostErrorProneWords: []
    };
    
    const wordPairs = [];
    const minLength = Math.min(originalText.length, userText.length);
    
    for (let i = 0; i < minLength; i++) {
      const origWord = originalText[i].toLowerCase();
      const userWord = userText[i].toLowerCase();
      
      if (origWord !== userWord) {
        wordPairs.push({ original: originalText[i], user: userText[i] });
      }
    }
    
    let omissionCount = 0;
    let additionCount = 0;
    let spellingCount = 0;
    let capitalizationCount = 0;
    const errorWords = [];
    
    wordPairs.forEach(pair => {
      const orig = pair.original.toLowerCase();
      const user = pair.user.toLowerCase();
      
      if (user === '') {
        omissionCount++;
      } else if (orig === '') {
        additionCount++;
      } else if (orig === user) {
        capitalizationCount++;
        errorWords.push(pair.original);
      } else if (isSimilar(orig, user)) {
        spellingCount++;
        errorWords.push(pair.original);
      } else {
        errorWords.push(pair.original);
      }
    });
    
    analysis.omissionRate = omissionCount / originalText.length;
    analysis.additionRate = additionCount / originalText.length;
    analysis.spellingErrorRate = spellingCount / originalText.length;
    analysis.capitalizationErrorRate = capitalizationCount / originalText.length;
    
    const wordFrequency = {};
    errorWords.forEach(word => {
      const lowerWord = word.toLowerCase();
      wordFrequency[lowerWord] = (wordFrequency[lowerWord] || 0) + 1;
    });
    
    analysis.mostErrorProneWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
    
    if (capitalizationCount > 0) {
      analysis.commonMistakes.push(`Capitalization errors (${capitalizationCount} instances)`);
    }
    if (spellingCount > 0) {
      analysis.commonMistakes.push(`Spelling mistakes (${spellingCount} instances)`);
    }
    if (omissionCount > 0) {
      analysis.commonMistakes.push(`Omitted words (${omissionCount} instances)`);
    }
    if (additionCount > 0) {
      analysis.commonMistakes.push(`Added extra words (${additionCount} instances)`);
    }
    
    return analysis;
  }
  
  function getOverallAssessment(accuracy, wpm) {
    let assessment = '';
    
    if (accuracy >= 95) {
      assessment += '<p>🌟 <strong>Excellent accuracy!</strong> Your transcription is nearly perfect.</p>';
    } else if (accuracy >= 85) {
      assessment += '<p>👍 <strong>Good accuracy.</strong> With a little more practice, you can reach excellence.</p>';
    } else if (accuracy >= 70) {
      assessment += '<p>📝 <strong>Fair accuracy.</strong> Focus on reducing errors to improve your score.</p>';
    } else {
      assessment += '<p⚠️ <strong>Needs improvement.</strong> Work on accuracy before increasing speed.</p>';
    }
    
    if (wpm >= 50) {
      assessment += '<p>⚡ <strong>Fast typer!</strong> Your speed is impressive. ';
      if (accuracy < 90) {
        assessment += 'Try slowing down slightly to improve accuracy.</p>';
      } else {
        assessment += 'Maintain this speed while keeping accuracy high.</p>';
      }
    } else if (wpm >= 40) {
      assessment += '<p>🏃 <strong>Moderate speed.</strong> You\'re typing at a good pace. ';
      assessment += 'With practice, you can increase speed without sacrificing accuracy.</p>';
    } else {
      assessment += '<p>🐢 <strong>Slow pace.</strong> Focus on building muscle memory and gradually increasing your speed.</p>';
    }
    
    return assessment;
  }
  
  function getImprovementSuggestions(analysis, stats) {
    let suggestions = [];
    
    if (analysis.omissionRate > 0.2) {
      suggestions.push('You\'re skipping many words. Practice reading ahead to anticipate upcoming words.');
    }
    
    if (analysis.additionRate > 0.15) {
      suggestions.push('You\'re adding extra words. Focus on typing only what you see/hear.');
    }
    
    if (analysis.spellingErrorRate > 0.25) {
      suggestions.push('Spelling mistakes are frequent. Consider practicing difficult words separately.');
    }
    
    if (analysis.capitalizationErrorRate > 0.1) {
      suggestions.push('Watch your capitalization. Remember proper nouns and sentence starts need capitals.');
    }
    
    suggestions.push('Practice difficult sections repeatedly until you master them.');
    suggestions.push('Break long passages into smaller chunks for focused practice.');
    suggestions.push('Focus on accuracy before speed - speed will come naturally with practice.');
    
    return suggestions.map(s => `<li>${s}</li>`).join('');
  }

  // Load global tests from Firebase
  function loadGlobalTests() {
    database.ref('tests').once('value')
      .then(snapshot => {
        globalTestsList.innerHTML = '';
        const tests = snapshot.val();
        
        if (!tests) {
          globalTestsList.innerHTML = '<p>No community tests yet. Be the first to share one!</p>';
          return;
        }
        
        Object.entries(tests).forEach(([id, test]) => {
          const testCard = document.createElement('div');
          testCard.className = 'test-card';
          testCard.innerHTML = `
            <h4>${test.title}</h4>
            <p>${test.text.substring(0, 100)}${test.text.length > 100 ? '...' : ''}</p>
            <div class="test-author">
              <img src="${test.userPhoto}" alt="${test.userName}">
              <span>Added by ${test.userName}</span>
            </div>
          `;
          testCard.addEventListener('click', () => {
            // Remove selected class from all cards
            document.querySelectorAll('.test-card').forEach(card => {
              card.classList.remove('selected');
            });
            // Add selected class to clicked card
            testCard.classList.add('selected');
            
            originalTextEl.value = test.text;
            originalTextGroup.classList.add('hidden');
            timerOptions.classList.remove('hidden');
            timerButtons.forEach(btn => {
              btn.disabled = false;
              btn.style.opacity = '1';
            });
          });
          globalTestsList.appendChild(testCard);
        });
      })
      .catch(error => {
        console.error('Error loading tests:', error);
        globalTestsList.innerHTML = '<p>Error loading community tests. Please try again later.</p>';
      });
  }

  // Save test to Firebase
  saveBtn.addEventListener('click', () => {
    const user = auth.currentUser;
    if (!user) {
      alert('Please login to save tests.');
      return;
    }

    const title = customTitle.value.trim();
    const text = customOriginal.value.trim();
    
    if (!title || !text) {
      alert('Please enter both a title and the original text.');
      return;
    }

    const testData = {
      title,
      text,
      userName: user.displayName,
      userPhoto: user.photoURL,
      timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref('tests').push(testData)
      .then(() => {
        alert('Test saved and shared with the community!');
        customTitle.value = '';
        customOriginal.value = '';
        loadGlobalTests();
      })
      .catch(error => {
        console.error('Error saving test:', error);
        alert('Failed to save test. Please try again.');
      });
  });

  // Clear user's tests
  clearBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all your shared tests?')) {
      const user = auth.currentUser;
      if (!user) return;

      database.ref('tests').once('value')
        .then(snapshot => {
          const updates = {};
          snapshot.forEach(child => {
            if (child.val().userName === user.displayName) {
              updates[child.key] = null;
            }
          });
          return database.ref('tests').update(updates);
        })
        .then(() => {
          alert('Your shared tests have been removed.');
          loadGlobalTests();
        })
        .catch(error => {
          console.error('Error clearing tests:', error);
          alert('Failed to clear tests. Please try again.');
        });
    }
  });
});