// Render modal content
  const renderModal = () => {
    if (!showModal) return null;

    if (showModal === 'EDIT_PLAYER') {
        return (
          <div className="modal open">
            <div className="modal-overlay" onClick={() => {
              setShowModal(null);
              setEditingPlayer(null);
            }}></div>
            <div className="modal-content">
              <h3>Edit {editingPlayer?.type === 'batsman' ? 'Batsman' : 'Bowler'} Name</h3>
              <input
                type="text"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder={`Enter ${editingPlayer?.type} name`}
                autoFocus
              />
              <div className="modal-actions">
                <button onClick={() => {
                  setShowModal(null);
                  setEditingPlayer(null);
                }} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={savePlayerName} className="ok-btn">
                  Save
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (showModal === 'CHANGE_BOWLER') {
        const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
        const availableBowlers = teams[currentBowlingTeam].bowlers
          .filter(bowler => bowler.id !== players.lastBowler)
          .map(bowler => ({
            ...bowler,
            overs: `${Math.floor(bowler.balls / settings.ballsPerOver)}.${bowler.balls % settings.ballsPerOver}`
          }));
      
        return (
          <div className="modal open">
            <div className="modal-overlay" onClick={() => setShowModal(null)}></div>
            <div className="modal-content">
              <h3>Select Next Bowler</h3>
              <div className="bowler-options">
                {availableBowlers.map(bowler => (
                  <div
                    key={bowler.id}
                    className={`bowler-option ${players.bowler.id === bowler.id ? 'current-bowler' : ''}`}
                    onClick={() => {
                      handleBowlerChange(bowler.id);
                      setShowModal(null);
                    }}
                  >
                    <div className="bowler-info">
                      <span className="bowler-name">{bowler.name}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button 
                  onClick={() => setShowModal(null)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      }

    const handleSelect = (value) => setModalData(prev => ({ ...prev, value }));
    const handleSelectRetire = (type, batter) => setModalData({ type, batter });

    const renderNumberOptions = () => (
      <div className="number-grid">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
          <button 
            key={num} 
            onClick={() => handleSelect(num)}
            className={modalData.value === num ? 'selected' : ''}
          >
            {num}
          </button>
        ))}
      </div>
    );

    const renderOutOptions = () => (
      <div className="out-options">
        {['Bowled', 'Caught', 'Run Out', 'Hit Wicket', 'Other'].map(type => (
          <button 
            key={type} 
            onClick={() => handleSelect(type)}
            className={modalData.value === type ? 'selected' : ''}
          >
            {type}
          </button>
        ))}
      </div>
    );

    const renderRetireOptions = () => (
      <div className="retire-options">
        <div className="retire-types">
          <h4>Retire Type</h4>
          {['Retired', 'Retired Out'].map(type => (
            <button 
              key={type} 
              onClick={() => setModalData(prev => ({ ...prev, type }))}
              className={modalData.type === type ? 'selected' : ''}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="batter-selection">
          <h4>Select Batter</h4>
          {['Striker', 'Non-Striker'].map(batter => (
            <button 
              key={batter} 
              onClick={() => setModalData(prev => ({ ...prev, batter }))}
              className={modalData.batter === batter ? 'selected' : ''}
            >
              {batter}
            </button>
          ))}
        </div>
      </div>
    );

 // temporary names for editing

const handleStartEditNames = () => {
  setEditingTeam("choose");
};

const handleChooseTeam = (teamKey) => {
  setEditingTeam(teamKey);
  const currentPlayers = teams[teamKey].batsmen;
  setTempNames(currentPlayers.map(p => ({ id: p.id, name: p.name })));
};

const handleTempNameChange = (id, newName) => {
  setTempNames(prev =>
    prev.map(p => p.id === id ? { ...p, name: newName } : p)
  );
};

const handleSaveNames = () => {
  setTeams(prev => ({
    ...prev,
    [editingTeam]: {
      ...prev[editingTeam],
      batsmen: prev[editingTeam].batsmen.map(p => {
        const updated = tempNames.find(t => t.id === p.id);
        return updated ? { ...p, name: updated.name } : p;
      }),
    }
  }));
  setEditingTeam(null);
  setTempNames([]);
};

const handleCancelEdit = () => {
  setEditingTeam(null);
  setTempNames([]);
};

const renderSettingsOptions = () => {
  // === Restriction: Only before match starts (1st innings, 0 balls bowled)
  if (match.innings !== 1 || match.balls > 0) {
    return <p>Settings can only be changed before the match starts</p>;
  }

  // === Step 3: Edit Player Names
  if (editingTeam && editingTeam !== "choose") {
    return (
      <div className="edit-players-screen">
        <h3>Edit Player Names - {editingTeam === 'teamA' ? 'Team A' : 'Team B'}</h3>
        {tempNames.map((player, index) => (
          <div key={player.id} className="setting-item">
            <label>Player {index + 1}:</label>
            <input
              type="text"
              value={player.name}
              onChange={(e) => handleTempNameChange(player.id, e.target.value)}
            />
          </div>
        ))}
        <div style={{ marginTop: '1rem' }}>
          <button onClick={handleSaveNames}>Save</button>
          <button onClick={handleCancelEdit} style={{ marginLeft: '1rem' }}>Cancel</button>
        </div>
      </div>
    );
  }

  // === Step 2: Choose Team to Edit
  if (editingTeam === "choose") {
    return (
      <div className="choose-team-screen">
        <h3>Choose a team to edit player names:</h3>
        <button onClick={() => handleChooseTeam("teamA")}>Team A</button>
        <button onClick={() => handleChooseTeam("teamB")} style={{ marginLeft: '1rem' }}>Team B</button>
        <div style={{ marginTop: '1rem' }}>
          <button onClick={handleCancelEdit}>Cancel</button>
        </div>
      </div>
    );
  }

  // === Step 1: Show all Settings options
  return (
    <div className="settings-options">
      <div className="setting-item">
        <label>Overs per innings:</label>
        <input
          type="number"
          min="1"
          max="50"
          value={settings.overs}
          onChange={(e) => handleChangeOvers(parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="setting-item">
        <label>Wide ball runs:</label>
        <input
          type="number"
          min="1"
          max="5"
          value={settings.wideBallRuns}
          onChange={(e) => handleChangeExtraRuns('WD', parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="setting-item">
        <label>No ball runs:</label>
        <input
          type="number"
          min="1"
          max="5"
          value={settings.noBallRuns}
          onChange={(e) => handleChangeExtraRuns('NB', parseInt(e.target.value) || 1)}
        />
      </div>

      <div className="setting-item">
        <label>Balls per over:</label>
        <input
          type="number"
          min="1"
          max="10"
          value={settings.ballsPerOver}
          onChange={(e) => handleChangeBallsPerOver(parseInt(e.target.value) || 6)}
        />
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button onClick={handleStartEditNames}>Edit Player Names</button>
      </div>
    </div>
  );
};


    return (
      <div className={`modal ${showModal ? 'open' : ''}`}>
        <div className="modal-overlay" onClick={() => {
          setShowModal(null);
          setSelectedAction(null);
        }}></div>
        <div className="modal-content">
          <h3>
            {showModal === 'WD' && 'Select Wide Runs'}
            {showModal === 'NB' && 'Select No Ball Runs'}
            {showModal === 'OUT' && 'Select Dismissal Type'}
            {showModal === 'Retire' && 'Retire Batsman'}
            {showModal === '5,7..' && 'Select Runs'}
            {showModal === 'BYE' && 'Select Bye Runs'}
            {showModal === 'SETTINGS' && 'Match Settings'}
          </h3>
          
          {['WD', 'NB', '5,7..', 'BYE'].includes(showModal) && renderNumberOptions()}
          {showModal === 'OUT' && renderOutOptions()}
          {showModal === 'Retire' && renderRetireOptions()}
          {showModal === 'SETTINGS' && renderSettingsOptions()}
          
          <div className="modal-actions">
            <button onClick={() => {
              setShowModal(null);
              setSelectedAction(null);
            }} className="cancel-btn">Cancel</button>
            {showModal !== 'SETTINGS' && (
              <button onClick={handleOK} className="ok-btn">OK</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="live-score-container">
      <div className="header-actions">
        <button 
          className="settings-btn"
          onClick={() => setShowSettingsPanel(!showSettingsPanel)}
        >
          <FiSettings size={20} />
        </button>
        
        <div className="view-buttons">
          <button className="view-btn active">Live Scorecard</button>
          <button 
            className="view-btn"
            onClick={onShowFullScorecard}
          >
            Full Scorecard
          </button>
        </div>
      </div>

      {showSettingsPanel && (
        <div className="settings-panel">
          <h3>Match Settings</h3>
          <ul>
            <li onClick={() => setShowModal('SETTINGS')}>Change Overs Settings</li>
            <li onClick={() => setShowModal('SETTINGS')}>WD/NB Runs Settings</li>
            <li onClick={() => setShowModal('SETTINGS')}>Edit Balls Settings</li>
            <li onClick={() => setShowModal('EDIT_PLAYER')}>Edit Player Names</li>
          </ul>
        </div>
      )}

      <div className="upper-section">
        <div className="top-bar">
          <h2 className="match-title">
            {match.innings === 1 ? '1st Innings' : '2nd Innings'}
            {match.isComplete && ' - Match Complete'}
          </h2>
        </div>

        <div className="score-info">
          <div className="score-display">
            <h1>{match.runs}/{match.wickets}</h1>
            <p className="over-display">Overs: {overs}</p>
            <p className="crr">CRR: {crr}</p>
          </div>

          {match.isChasing && !match.isComplete && (
            <div className="target-info">
              <p>Target: {match.target}</p>
              <p>Need {Math.max(0, remainingRuns)} runs from {remainingBalls} balls</p>
              <p>Req. RR: {requiredRunRate}</p>
            </div>
          )}

            <div className="batsmen-info">
            <div className={`batsman striker`}>
                <p 
                className="batsman-name"
                onClick={() => {
                    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
                    startEditingPlayer('batsman', players.striker.id, currentBattingTeam);
                }}
                >
                {players.striker.name}
                </p>
                <p className="batsman-runs">{players.striker.runs}</p>
                <p className="batsman-balls">({players.striker.balls})</p>
                {players.striker.isOut && <span className="out-status">{players.striker.outType}</span>}
            </div>
            <div className={`batsman`}>
                <p 
                className="batsman-name"
                onClick={() => {
                    const currentBattingTeam = match.innings === 1 ? 'teamA' : 'teamB';
                    startEditingPlayer('batsman', players.nonStriker.id, currentBattingTeam);
                }}
                >
                {players.nonStriker.name}
                </p>
                <p className="batsman-runs">{players.nonStriker.runs}</p>
                <p className="batsman-balls">({players.nonStriker.balls})</p>
                {players.nonStriker.isOut && <span className="out-status">{players.nonStriker.outType}</span>}
            </div>
            </div>

            <div className="bowler-info">
                <p className="section-title">Bowler</p>
                <div className="bowler-display">
                    <p 
                    className="bowler-name"
                    onClick={() => {
                        const currentBowlingTeam = match.innings === 1 ? 'teamB' : 'teamA';
                        startEditingPlayer('bowler', players.bowler.id, currentBowlingTeam);
                    }}
                    >
                    {players.bowler.name}
                    </p>
                    <div className="bowler-display">
                    <BowlerDisplay bowler={
                        teams[match.innings === 1 ? 'teamB' : 'teamA'].bowlers.find(
                        b => b.id === players.bowler.id)} />
                        <button 
                            className="change-bowler-btn"
                            onClick={() => setShowModal('CHANGE_BOWLER')}
                        >
                            Change Bowler
                        </button>
                    </div>
                </div>
            </div>

          {overHistory.length > 0 && (
            <div className="over-history">
              <p className="section-title">This Over</p>
              <p>{overHistory.join(' ')}</p>
            </div>
          )}
        </div>
      </div>

      {!match.isComplete && (
        <div className="lower-section">
          <div className="button-row long-buttons">
            <button 
              className="long-btn" 
              onClick={() => {
                saveState();
                endInnings();
              }}
            >
              End Innings
            </button>
            <button onClick={() => handleActionClick('Retire')}>
              Retire
            </button>
            <button onClick={() => {
              saveState();
              setPlayers(prev => ({
                ...prev,
                striker: prev.nonStriker,
                nonStriker: prev.striker
              }));
              setSelectedAction(null);
            }}>
              Change Strike
            </button>
          </div>

          <div className="button-grid">
            {['WD', 'NB', 'BYE', '0', '1', '2', '3', '4', '6', '5,7..', 'OUT'].map((btn) => (
              <button
                key={btn}
                onClick={() => handleActionClick(btn)}
                className={`${selectedAction === btn ? 'selected' : ''} ${
                  ['WD', 'NB'].includes(btn) ? 'extra-btn' : 
                  ['BYE'].includes(btn) ? 'other-extra-btn' :
                  btn === 'OUT' ? 'wicket-btn' : 
                  btn === '5,7..' ? 'uncommon-btn' : 'runs-btn'
                }`}
              >
                {btn}
              </button>
            ))}
          </div>

          <div className="action-buttons">
            <button 
              onClick={handleUndo} 
              className="undo-btn" 
              disabled={history.length === 0}
            >
              Undo
            </button>
            
          </div>
        </div>
      )}

      {renderModal()}
    </div>
  );


export default ScorecardPage;