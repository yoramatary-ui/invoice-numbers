(function () {
  const form = document.getElementById('upload-form');
  const statusEl = document.getElementById('status');
  const submitBtn = document.getElementById('submit-btn');

  function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (type ? ' ' + type : '');
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    setStatus('מעבד קבצים...', '');
    submitBtn.disabled = true;

    try {
      const formData = new FormData(form);
      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'אירעה שגיאה בעיבוד הקבצים');
      }

      const unmatchedHeader = response.headers.get('X-Unmatched-Files');
      const blob = await response.blob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stamped-pdfs.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      let message = 'ההורדה הושלמה בהצלחה!';
      if (unmatchedHeader) {
        const unmatched = JSON.parse(decodeURIComponent(unmatchedHeader));
        if (unmatched.length > 0) {
          message += `\nהקבצים הבאים לא נמצאה עבורם התאמה באקסל: ${unmatched.join(', ')}`;
        }
      }
      setStatus(message, 'success');
    } catch (err) {
      setStatus(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
