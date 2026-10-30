import { jsPDF } from 'jspdf'

interface ResultsPdfTally {
  position: string
  totalValid: number
  blank: number
  results: { name: string; votes: number }[]
}

export interface ResultsPdfElection {
  slug: string
  name: string
  organization: string
  status: string
  startAt: string
  endAt: string
  eligibleVoters: number
  participated: number
  results: ResultsPdfTally[] | null
  computedAt: string | null
  verifiedAt: string | null
  publishedAt: string | null
}

const GREEN: [number, number, number] = [20, 83, 45]
const ORANGE: [number, number, number] = [194, 65, 12]
const INK: [number, number, number] = [31, 41, 55]
const MUTED: [number, number, number] = [75, 85, 99]
const LINE: [number, number, number] = [209, 213, 219]

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: 'Africa/Accra',
  }) + ' GMT'
}

export function buildResultsPdf(election: ResultsPdfElection, logoDataUrl?: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 42
  const contentWidth = pageWidth - margin * 2
  let y = margin

  function text(value: string, x: number, baseline: number, maxWidth?: number) {
    if (!maxWidth || doc.getTextWidth(value) <= maxWidth) return doc.text(value, x, baseline)
    let shortened = value
    while (shortened.length > 1 && doc.getTextWidth(`${shortened}...`) > maxWidth) {
      shortened = shortened.slice(0, -1)
    }
    return doc.text(`${shortened}...`, x, baseline)
  }

  function continuationHeader() {
    doc.setFillColor(255, 255, 255)
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    text(election.organization, margin, y, contentWidth)
    y += 14
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    text(`${election.name} | Results report`, margin, y, contentWidth)
    y += 12
    doc.setDrawColor(...GREEN)
    doc.setLineWidth(1)
    doc.line(margin, y, pageWidth - margin, y)
    y += 24
  }

  function ensureSpace(required: number) {
    if (y + required <= pageHeight - 52) return
    doc.addPage()
    y = margin
    continuationHeader()
  }

  function tableHeader() {
    doc.setFillColor(237, 247, 240)
    doc.rect(margin, y - 13, contentWidth, 23, 'F')
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Candidate', margin + 9, y + 2)
    doc.text('Votes', pageWidth - margin - 142, y + 2)
    doc.text('Valid %', pageWidth - margin - 65, y + 2)
    y += 25
  }

  // Official report header.
  if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', margin, y, 58, 58)
  const titleX = logoDataUrl ? margin + 74 : margin
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  text(election.organization, titleX, y + 16, pageWidth - margin - titleX)
  doc.setTextColor(...INK)
  doc.setFontSize(12)
  text(election.name, titleX, y + 36, pageWidth - margin - titleX)
  doc.setTextColor(...ORANGE)
  doc.setFontSize(9)
  const reportStatus = election.publishedAt ? 'OFFICIAL PUBLISHED RESULTS' : election.verifiedAt ? 'VERIFIED RESULTS - AWAITING PUBLICATION' : 'PROVISIONAL TALLY REPORT'
  doc.text(reportStatus, titleX, y + 53)
  y += 73
  doc.setDrawColor(...GREEN)
  doc.setLineWidth(1.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 24

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const votingPeriod = `Voting period: ${formatDate(election.startAt)} to ${formatDate(election.endAt)}`
  for (const line of doc.splitTextToSize(votingPeriod, contentWidth)) {
    doc.text(line, margin, y)
    y += 13
  }
  doc.text(`Tally computed: ${formatDate(election.computedAt)}`, margin, y)
  y += 13
  if (election.verifiedAt) {
    doc.text(`Verified: ${formatDate(election.verifiedAt)}`, margin, y)
    y += 13
  }
  if (election.publishedAt) {
    doc.text(`Published: ${formatDate(election.publishedAt)}`, margin, y)
    y += 13
  }
  y += 8

  const turnout = election.eligibleVoters > 0 ? (election.participated / election.eligibleVoters) * 100 : 0
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.7)
  doc.line(margin, y, pageWidth - margin, y)
  y += 18
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  doc.setFontSize(10)
  doc.text(`Eligible voters: ${election.eligibleVoters.toLocaleString()}`, margin, y)
  doc.text(`Ballots accepted: ${election.participated.toLocaleString()}`, margin + 180, y)
  doc.text(`Turnout: ${turnout.toFixed(1)}%`, margin + 370, y)
  y += 18
  doc.setDrawColor(...LINE)
  doc.line(margin, y, pageWidth - margin, y)
  y += 30

  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Election Results', margin, y)
  y += 24

  for (const tally of election.results ?? []) {
    ensureSpace(78)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    text(tally.position, margin, y, contentWidth - 180)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`${tally.totalValid.toLocaleString()} valid | ${tally.blank.toLocaleString()} blank`, pageWidth - margin, y, { align: 'right' })
    y += 20
    tableHeader()
    for (const [index, result] of tally.results.entries()) {
      ensureSpace(24)
      if (index % 2 === 1) {
        doc.setFillColor(249, 250, 251)
        doc.rect(margin, y - 13, contentWidth, 23, 'F')
      }
      const percentage = tally.totalValid > 0 ? (result.votes / tally.totalValid) * 100 : 0
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      text(result.name, margin + 9, y + 2, contentWidth - 180)
      doc.setFont('helvetica', 'bold')
      doc.text(result.votes.toLocaleString(), pageWidth - margin - 142, y + 2)
      doc.setFont('helvetica', 'normal')
      doc.text(`${percentage.toFixed(1)}%`, pageWidth - margin - 65, y + 2)
      y += 23
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.4)
      doc.line(margin, y - 10, pageWidth - margin, y - 10)
    }
    y += 18
  }

  // Dedicated signature page for the EC Chairperson and all aspirants.
  doc.addPage()
  y = margin
  continuationHeader()
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Certification and Signatures', margin, y)
  y += 20
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const line of doc.splitTextToSize('The EC Chairperson and all aspirants may sign below to acknowledge this results report.', contentWidth)) {
    doc.text(line, margin, y)
    y += 13
  }
  y += 15

  ensureSpace(68)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('EC Chairperson', margin, y)
  y += 26
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.7)
  doc.line(margin, y, margin + 205, y)
  doc.line(margin + 245, y, margin + 385, y)
  doc.line(margin + 425, y, pageWidth - margin, y)
  y += 13
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Full name', margin, y)
  doc.text('Signature', margin + 245, y)
  doc.text('Date', margin + 425, y)
  y += 30

  function signatureColumnHeader() {
    doc.setFillColor(237, 247, 240)
    doc.rect(margin, y - 13, contentWidth, 22, 'F')
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Aspirant', margin + 7, y + 1)
    doc.text('Signature', margin + 245, y + 1)
    doc.text('Date', margin + 425, y + 1)
    y += 24
  }

  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Aspirant Signatures', margin, y)
  y += 22
  signatureColumnHeader()

  for (const tally of election.results ?? []) {
    ensureSpace(51)
    doc.setFillColor(255, 247, 237)
    doc.rect(margin, y - 12, contentWidth, 20, 'F')
    doc.setTextColor(...ORANGE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    text(tally.position, margin + 7, y + 2, contentWidth - 14)
    y += 23
    for (const result of tally.results) {
      if (y + 28 > pageHeight - 52) {
        doc.addPage()
        y = margin
        continuationHeader()
        doc.setTextColor(...GREEN)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(`Aspirant Signatures - ${tally.position}`, margin, y)
        y += 22
        signatureColumnHeader()
      }
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      text(result.name, margin + 7, y + 2, 215)
      doc.setDrawColor(...INK)
      doc.setLineWidth(0.55)
      doc.line(margin + 245, y + 4, margin + 385, y + 4)
      doc.line(margin + 425, y + 4, pageWidth - margin, y + 4)
      y += 20
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.35)
      doc.line(margin, y - 8, pageWidth - margin, y - 8)
      y += 8
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`Generated ${formatDate(new Date().toISOString())}`, margin, pageHeight - 22)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 22, { align: 'right' })
  }

  return doc
}

async function loadSchoolLogo() {
  const response = await fetch('/school-logo.png')
  if (!response.ok) throw new Error('The school logo could not be loaded')
  const blob = await response.blob()
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('The school logo could not be read'))
    reader.readAsDataURL(blob)
  })
}

export async function downloadResultsPdf(election: ResultsPdfElection) {
  const logo = await loadSchoolLogo()
  const doc = buildResultsPdf(election, logo)
  doc.save(`${election.slug}-results-report.pdf`)
}
