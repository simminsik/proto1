import React from 'react';
import ExcelUploader from './components/ExcelUploaderLocal';
import ExcelUploaderApi from './components/ExcelUploaderApi';
function App() {
  return (
    <div className="App">
      <h1>사원 정보 관리</h1>
      <ExcelUploader />
      <ExcelUploaderApi/>
    </div>
  );
}

export default App;
