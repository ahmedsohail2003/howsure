// Save text as a file through the browser's download (Export, build-out item 1.2). Nothing is sent
// anywhere: the file is made in the page from a Blob.

export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked later, not at once: some browsers start reading the Blob after click() returns.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
