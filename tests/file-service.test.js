const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { cleanFileName, parseCsv, parseTsv, ensureExtension, exportOfficeFile, openOfficeFile, validateProject, assertSheetDimensions } = require('../src/file-service');

test('cleanFileName removes unsafe characters and limits length', () => {
  assert.equal(cleanFileName('budget: 2026/report?'), 'budget_ 2026_report_');
  assert.ok(cleanFileName('x'.repeat(200)).length <= 120);
});

test('parseCsv handles quoted commas, quotes, and new lines', () => {
  assert.deepEqual(parseCsv('Name,Note\r\nAlex,"hello, world"\r\nSam,"said ""hi"""'), [
    ['Name','Note'], ['Alex','hello, world'], ['Sam','said "hi"']
  ]);
});

test('parseTsv preserves quoted tabs, quotes, and new lines', () => {
  assert.deepEqual(parseTsv('Name\tNote\r\nAlex\t"hello\tworld"\r\nSam\t"said ""hi"""'), [
    ['Name','Note'], ['Alex','hello\tworld'], ['Sam','said "hi"']
  ]);
});

test('save paths receive the default extension only when missing', () => {
  assert.equal(ensureExtension('/tmp/report', 'docx'), '/tmp/report.docx');
  assert.equal(ensureExtension('/tmp/report.csv', 'xlsx'), '/tmp/report.csv');
  assert.equal(ensureExtension('/tmp/report.', 'pdf'), '/tmp/report.pdf');
});

test('TSV files import with tab-aware quoting', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-tsv-'));
  const filePath = path.join(directory, 'test.tsv');
  try {
    await fs.writeFile(filePath, 'Name\tNote\r\nAlex\t"hello\tworld"', 'utf8');
    const imported = await openOfficeFile(filePath);
    assert.deepEqual(imported.cells, [['Name','Note'], ['Alex','hello\tworld']]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('Brightdesk project file can be saved and reopened', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-test-'));
  const filePath = path.join(directory, 'test.bdesk');
  const project = { title: 'Test', docs: { pages: { title: 'My page', html: '<p>Hello</p>' } } };
  try {
    await exportOfficeFile({ project }, filePath);
    const reopened = await openOfficeFile(filePath);
    assert.deepEqual(reopened, project);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('CSV export writes valid quoted cells', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-csv-'));
  const filePath = path.join(directory, 'test.csv');
  try {
    await exportOfficeFile({ kind: 'sheets', title: 'Test', rows: [['Name','Value'], ['Alex','a,b'], ['Sam','say "hi"']] }, filePath);
    const data = (await fs.readFile(filePath, 'utf8')).replace(/^\uFEFF/, '');
    assert.deepEqual(parseCsv(data), [['Name','Value'], ['Alex','a,b'], ['Sam','say "hi"']]);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});


test('Brightdesk project validation rejects malformed document collections and unknown modules', () => {
  assert.throws(() => validateProject({ title: 'Bad', docs: [] }), /invalid document collection/);
  assert.throws(() => validateProject({ title: 'Bad', docs: { pages: 'not a document' } }), /document is not valid/);
  assert.throws(() => validateProject({ title: 'Bad', docs: { outlook: { title: 'Mail' } } }), /unsupported app module/);
  assert.throws(() => validateProject({ title: 'Bad', docs: { unknown: { title: 'Unknown' } } }), /unsupported app module/);
});

test('Brightdesk project validation enforces core document size and shape limits', () => {
  assert.throws(() => validateProject({ docs: { pages: { html: 'x'.repeat(10 * 1024 * 1024 + 1) } } }), /10 MB limit/);
  assert.throws(() => validateProject({ docs: { sheets: { cells: [['=SUM(A1:A2)', { bad: true }]] } } }), /unsupported cell value/);
  assert.throws(() => validateProject({ docs: { slides: { slides: [{ title: 'Slide' }], current: 3 } } }), /invalid selected slide/);
});

test('Brightdesk project import rejects malformed JSON with a clear error', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-invalid-project-'));
  const filePath = path.join(directory, 'broken.bdesk');
  try {
    await fs.writeFile(filePath, '{not json', 'utf8');
    await assert.rejects(openOfficeFile(filePath), /not valid JSON/);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('text imports reject malformed UTF-8 rather than silently replacing bytes', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-invalid-utf8-'));
  const invalidText = Buffer.from([0x6e,0x61,0x6d,0x65,0x2c,0x76,0x61,0x6c,0x75,0x65,0x0a,0x41,0x6c,0x65,0x78,0x2c,0xc3,0x28]);
  const invalidProject = Buffer.concat([
    Buffer.from('{"docs":{"notes":{"text":"'),
    Buffer.from([0xc3,0x28]),
    Buffer.from('"}}}')
  ]);
  try {
    for (const extension of ['.csv','.tsv','.txt','.md','.html']) {
      const filePath = path.join(directory, 'broken' + extension);
      await fs.writeFile(filePath, invalidText);
      await assert.rejects(openOfficeFile(filePath), /not valid UTF-8 text/);
    }
    const projectPath = path.join(directory, 'broken.bdesk');
    await fs.writeFile(projectPath, invalidProject);
    await assert.rejects(openOfficeFile(projectPath), /not valid UTF-8 JSON/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('CSV and TSV imports reject spreadsheets over the 250,000-cell limit', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-large-sheet-'));
  const columns = Array(250001).fill('x');
  try {
    for (const extension of ['.csv', '.tsv']) {
      const row = Buffer.from(columns.join(extension === '.tsv' ? '\t' : ','));
      const filePath = path.join(directory, 'large' + extension);
      await fs.writeFile(filePath, row);
      await assert.rejects(openOfficeFile(filePath), /250,000-cell limit/);
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('TXT, Markdown and HTML imports enforce the 10 MB text limit', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-large-text-'));
  const oversizedText = Buffer.alloc(10 * 1024 * 1024 + 1, 0x61);
  try {
    for (const extension of ['.txt', '.md', '.html']) {
      const filePath = path.join(directory, 'large' + extension);
      await fs.writeFile(filePath, oversizedText);
      await assert.rejects(openOfficeFile(filePath), /10 MB text limit/);
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('CSV and TSV parsers stop as soon as the 250,000-cell limit is exceeded', () => {
  const csv = Array(250001).fill('x').join(',');
  const tsv = Array(250001).fill('x').join('\t');
  assert.throws(() => parseCsv(csv), /250,000-cell limit/);
  assert.throws(() => parseTsv(tsv), /250,000-cell limit/);
});

test('XLSX worksheet dimensions reject oversized cell grids before row conversion', () => {
  assert.doesNotThrow(() => assertSheetDimensions(250000, 0));
  assert.doesNotThrow(() => assertSheetDimensions(0, 250000));
  assert.throws(() => assertSheetDimensions(250001, 0), /250,000-cell limit/);
  assert.throws(() => assertSheetDimensions(0, 250001), /250,000-cell limit/);

  assert.doesNotThrow(() => assertSheetDimensions(500, 500));
  assert.doesNotThrow(() => assertSheetDimensions(0, 0));
  assert.throws(() => assertSheetDimensions(500001, 1), /250,000-cell limit/);
  assert.throws(() => assertSheetDimensions(501, 500), /250,000-cell limit/);
});

test('CSV and TSV parsers reject malformed quotes and preserve empty quoted cells', () => {
  const cases = [
    [parseCsv, 'Name,Note\nAlex,"hello"', [['Name','Note'], ['Alex','hello']]],
    [parseTsv, 'Name\tNote\nAlex\t"hello"', [['Name','Note'], ['Alex','hello']]]
  ];
  for (const [parse, validInput, expected] of cases) {
    assert.throws(() => parse('"unfinished'), /invalid quotation/);
    assert.throws(() => parse('Alex"bad,value'), /invalid quotation/);
    assert.throws(() => parse('"closed"trailing,value'), /invalid quotation/);
    assert.deepEqual(parse(validInput), expected);
    assert.deepEqual(parse('""'), [['']]);
  }
});


test('Brightdesk project validation accepts a valid multi-worksheet workbook', () => {
  const project = {
    title: 'Quarterly plan',
    docs: {
      sheets: {
        title: 'Quarterly plan',
        activeWorksheetId: 'sheet-2',
        cells: [['Costs', '25']],
        worksheets: [
          { id: 'sheet-1', name: 'Sales', cells: [['Revenue', '100']] },
          { id: 'sheet-2', name: 'Costs', cells: [['Costs', '25']] }
        ]
      }
    }
  };
  assert.equal(validateProject(project), project);
});

test('Brightdesk project validation rejects invalid worksheet names, duplicate tabs and unknown active sheets', () => {
  const projectWith = worksheets => ({ docs: { sheets: { worksheets, activeWorksheetId: worksheets[0]?.id } } });
  assert.throws(() => validateProject(projectWith([
    { id: 'one', name: 'Overview', cells: [['1']] },
    { id: 'two', name: 'overview', cells: [['2']] }
  ])), /duplicate worksheet name/i);
  assert.throws(() => validateProject(projectWith([
    { id: 'one', name: 'bad/name', cells: [['1']] }
  ])), /invalid worksheet name/i);
  assert.throws(() => validateProject({ docs: { sheets: {
    worksheets: [{ id: 'one', name: 'Overview', cells: [['1']] }],
    activeWorksheetId: 'missing'
  } } }), /active worksheet/i);
});

test('Brightdesk project files preserve every worksheet and the active selection', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-multi-sheet-project-'));
  const filePath = path.join(directory, 'quarterly-plan.bdesk');
  const project = {
    title: 'Quarterly plan',
    docs: {
      sheets: {
        title: 'Quarterly plan',
        activeWorksheetId: 'sheet-2',
        cells: [['Costs', '25']],
        worksheets: [
          { id: 'sheet-1', name: 'Sales', cells: [['Revenue', '100']], styles: { A1: { bold: true, color: '#1E6847' } } },
          { id: 'sheet-2', name: 'Costs', cells: [['Costs', '25']], styles: { B1: { numberFormat: 'currency' } } }
        ]
      }
    }
  };
  try {
    await exportOfficeFile({ project }, filePath);
    assert.deepEqual(await openOfficeFile(filePath), project);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('XLSX import and export preserve all worksheet names and values', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-multi-sheet-xlsx-'));
  const filePath = path.join(directory, 'quarterly-plan.xlsx');
  const payload = {
    kind: 'sheets',
    title: 'Quarterly plan',
    rows: [['Revenue', '100']],
    activeWorksheetId: 'sheet-2',
    worksheets: [
      { id: 'sheet-1', name: 'Sales', cells: [['Revenue', 100], ['North', 60]] },
      { id: 'sheet-2', name: 'Costs', cells: [['Costs', 25], ['Rent', 10]] }
    ]
  };
  try {
    await exportOfficeFile(payload, filePath);
    const imported = await openOfficeFile(filePath);
    assert.equal(imported.worksheets.length, 2);
    assert.deepEqual(imported.worksheets.map(sheet => sheet.name), ['Sales', 'Costs']);
    assert.deepEqual(imported.worksheets[0].cells, payload.worksheets[0].cells);
    assert.deepEqual(imported.worksheets[1].cells, payload.worksheets[1].cells);
    assert.equal(imported.activeWorksheetId, 'sheet-2');
    assert.deepEqual(imported.cells, payload.worksheets[1].cells);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('Brightdesk project validation accepts safe cell formatting and rejects invalid styles', () => {
  const valid = {
    docs: { sheets: {
      activeWorksheetId: 'one',
      worksheets: [{ id: 'one', name: 'Overview', cells: [['100']], styles: {
        A1: { bold: true, italic: false, underline: true, fill: '#EDF7F1', color: '#1E6847', numberFormat: 'currency' }
      } }]
    } }
  };
  assert.equal(validateProject(valid), valid);

  const invalidStyle = value => ({ docs: { sheets: {
    activeWorksheetId: 'one',
    worksheets: [{ id: 'one', name: 'Overview', cells: [['100']], styles: { A1: value } }]
  } } });
  assert.throws(() => validateProject(invalidStyle({ fill: 'red' })), /invalid cell formatting/i);
  assert.throws(() => validateProject(invalidStyle({ color: '#12345' })), /invalid cell formatting/i);
  assert.throws(() => validateProject(invalidStyle({ numberFormat: 'custom' })), /invalid cell formatting/i);
  assert.throws(() => validateProject(invalidStyle({ bold: 'yes' })), /invalid cell formatting/i);
  assert.throws(() => validateProject({
    docs: { sheets: { activeWorksheetId: 'one', worksheets: [
      { id: 'one', name: 'Overview', cells: [['100']], styles: { A0: { bold: true } } }
    ] } }
  }), /invalid cell address/i);
});

test('XLSX round trip preserves cell number formats, font, fill and worksheet-specific formatting', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-formatted-xlsx-'));
  const filePath = path.join(directory, 'formatted-workbook.xlsx');
  const payload = {
    kind: 'sheets',
    title: 'Formatted workbook',
    activeWorksheetId: 'costs',
    worksheets: [
      { id: 'sales', name: 'Sales', cells: [['Revenue', '1234.5']], styles: {
        B1: { bold: true, color: '#1E6847', numberFormat: 'currency' }
      } },
      { id: 'costs', name: 'Costs', cells: [['Ratio', '0.25']], styles: {
        B1: { italic: true, underline: true, fill: '#EDF7F1', numberFormat: 'percent' }
      } }
    ]
  };
  try {
    await exportOfficeFile(payload, filePath);
    const imported = await openOfficeFile(filePath);
    assert.deepEqual(imported.worksheets[0].styles.B1, {
      bold: true, italic: false, underline: false, fill: null, color: '#1E6847', numberFormat: 'currency'
    });
    assert.deepEqual(imported.worksheets[1].styles.B1, {
      bold: false, italic: true, underline: true, fill: '#EDF7F1', color: null, numberFormat: 'percent'
    });
    assert.equal(imported.activeWorksheetId, 'sheet-2');
    assert.deepEqual(imported.styles, imported.worksheets[1].styles);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('XLSX export applies legacy active-sheet styles to the actual active worksheet', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-active-sheet-style-'));
  const filePath = path.join(directory, 'active-sheet-style.xlsx');
  const payload = {
    kind: 'sheets',
    title: 'Active style',
    activeWorksheetId: 'second',
    styles: { A1: { bold: true, numberFormat: 'currency' } },
    worksheets: [
      { id: 'first', name: 'First', cells: [['One']] },
      { id: 'second', name: 'Second', cells: [['Two']] }
    ]
  };
  try {
    await exportOfficeFile(payload, filePath);
    const imported = await openOfficeFile(filePath);
    assert.equal(imported.worksheets[0].styles.A1, undefined);
    assert.equal(imported.worksheets[1].styles.A1.bold, true);
    assert.equal(imported.worksheets[1].styles.A1.numberFormat, 'currency');
    assert.equal(imported.activeWorksheetId, 'sheet-2');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('XLSX round trip preserves ISO date cells as dates with the selected display format', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brightdesk-date-format-'));
  const filePath = path.join(directory, 'date-format.xlsx');
  const payload = {
    kind: 'sheets',
    title: 'Date values',
    worksheets: [{
      id: 'dates',
      name: 'Dates',
      cells: [['2026-11-14']],
      styles: { A1: { numberFormat: 'date' } }
    }]
  };
  try {
    await exportOfficeFile(payload, filePath);
    const imported = await openOfficeFile(filePath);
    assert.equal(imported.cells[0][0], '2026-11-14');
    assert.equal(imported.styles.A1.numberFormat, 'date');
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
