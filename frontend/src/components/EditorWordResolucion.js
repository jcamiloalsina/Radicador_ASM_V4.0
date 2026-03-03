import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Minus,
  Table as TableIcon, Image as ImageIcon,
  Undo, Redo, Type, Palette, Highlighter,
  Plus, Trash2, RowsIcon, ColumnsIcon
} from 'lucide-react';
import { Button } from './ui/button';

// Estilos CSS para el editor
const editorStyles = `
  .tiptap-editor {
    min-height: 500px;
    padding: 20px;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 8px 8px;
    background: white;
    font-family: 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.6;
  }
  
  .tiptap-editor:focus {
    outline: none;
    border-color: #8b5cf6;
  }
  
  .tiptap-editor p {
    margin: 0.5em 0;
  }
  
  .tiptap-editor h1 {
    font-size: 24pt;
    font-weight: bold;
    margin: 0.5em 0;
  }
  
  .tiptap-editor h2 {
    font-size: 18pt;
    font-weight: bold;
    margin: 0.5em 0;
  }
  
  .tiptap-editor h3 {
    font-size: 14pt;
    font-weight: bold;
    margin: 0.5em 0;
  }
  
  .tiptap-editor ul, .tiptap-editor ol {
    padding-left: 24px;
    margin: 0.5em 0;
  }
  
  .tiptap-editor blockquote {
    border-left: 3px solid #8b5cf6;
    padding-left: 16px;
    margin: 1em 0;
    color: #64748b;
    font-style: italic;
  }
  
  .tiptap-editor hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 1em 0;
  }
  
  .tiptap-editor table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
  }
  
  .tiptap-editor th, .tiptap-editor td {
    border: 1px solid #cbd5e1;
    padding: 8px 12px;
    text-align: left;
  }
  
  .tiptap-editor th {
    background: #f1f5f9;
    font-weight: bold;
  }
  
  .tiptap-editor img {
    max-width: 100%;
    height: auto;
    margin: 1em 0;
  }
  
  .tiptap-editor .is-editor-empty:first-child::before {
    content: attr(data-placeholder);
    float: left;
    color: #94a3b8;
    pointer-events: none;
    height: 0;
  }
  
  .ProseMirror-selectednode {
    outline: 2px solid #8b5cf6;
  }
`;

// Barra de herramientas
const MenuBar = ({ editor }) => {
  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URL de la imagen:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const colors = ['#000000', '#dc2626', '#2563eb', '#16a34a', '#ca8a04', '#9333ea'];
  const highlightColors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'];

  if (!editor) return null;

  return (
    <div className="bg-slate-100 border border-slate-300 border-b-0 rounded-t-lg p-2 flex flex-wrap gap-1 items-center">
      {/* Deshacer/Rehacer */}
      <div className="flex gap-1 pr-2 border-r border-slate-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          title="Deshacer"
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
          title="Rehacer"
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      {/* Encabezados */}
      <div className="flex gap-1 pr-2 border-r border-slate-300">
        <select
          onChange={(e) => {
            const level = parseInt(e.target.value);
            if (level === 0) {
              editor.chain().focus().setParagraph().run();
            } else {
              editor.chain().focus().toggleHeading({ level }).run();
            }
          }}
          className="h-8 px-2 text-sm border border-slate-300 rounded bg-white"
          value={
            editor.isActive('heading', { level: 1 }) ? 1 :
            editor.isActive('heading', { level: 2 }) ? 2 :
            editor.isActive('heading', { level: 3 }) ? 3 : 0
          }
        >
          <option value={0}>Normal</option>
          <option value={1}>Título 1</option>
          <option value={2}>Título 2</option>
          <option value={3}>Título 3</option>
        </select>
      </div>

      {/* Formato de texto */}
      <div className="flex gap-1 pr-2 border-r border-slate-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bold') ? 'bg-slate-300' : ''}`}
          title="Negrita"
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('italic') ? 'bg-slate-300' : ''}`}
          title="Cursiva"
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('underline') ? 'bg-slate-300' : ''}`}
          title="Subrayado"
        >
          <UnderlineIcon className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('strike') ? 'bg-slate-300' : ''}`}
          title="Tachado"
        >
          <Strikethrough className="w-4 h-4" />
        </Button>
      </div>

      {/* Colores */}
      <div className="flex gap-1 pr-2 border-r border-slate-300 items-center">
        <div className="relative group">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Color de texto">
            <Palette className="w-4 h-4" />
          </Button>
          <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg p-2 hidden group-hover:flex gap-1 z-50">
            {colors.map(color => (
              <button
                key={color}
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="w-6 h-6 rounded border border-slate-300"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
        <div className="relative group">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Resaltado">
            <Highlighter className="w-4 h-4" />
          </Button>
          <div className="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg p-2 hidden group-hover:flex gap-1 z-50">
            {highlightColors.map(color => (
              <button
                key={color}
                onClick={() => editor.chain().focus().toggleHighlight({ color }).run()}
                className="w-6 h-6 rounded border border-slate-300"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Alineación */}
      <div className="flex gap-1 pr-2 border-r border-slate-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'left' }) ? 'bg-slate-300' : ''}`}
          title="Alinear izquierda"
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'center' }) ? 'bg-slate-300' : ''}`}
          title="Centrar"
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'right' }) ? 'bg-slate-300' : ''}`}
          title="Alinear derecha"
        >
          <AlignRight className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`h-8 w-8 p-0 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-slate-300' : ''}`}
          title="Justificar"
        >
          <AlignJustify className="w-4 h-4" />
        </Button>
      </div>

      {/* Listas */}
      <div className="flex gap-1 pr-2 border-r border-slate-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('bulletList') ? 'bg-slate-300' : ''}`}
          title="Lista con viñetas"
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('orderedList') ? 'bg-slate-300' : ''}`}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
      </div>

      {/* Otros elementos */}
      <div className="flex gap-1 pr-2 border-r border-slate-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`h-8 w-8 p-0 ${editor.isActive('blockquote') ? 'bg-slate-300' : ''}`}
          title="Cita"
        >
          <Quote className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8 p-0"
          title="Línea horizontal"
        >
          <Minus className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabla */}
      <div className="flex gap-1 pr-2 border-r border-slate-300">
        <Button
          variant="ghost"
          size="sm"
          onClick={insertTable}
          className="h-8 w-8 p-0"
          title="Insertar tabla"
        >
          <TableIcon className="w-4 h-4" />
        </Button>
        {editor.isActive('table') && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().addRowAfter().run()}
              className="h-8 px-2 text-xs"
              title="Agregar fila"
            >
              +Fila
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              className="h-8 px-2 text-xs"
              title="Agregar columna"
            >
              +Col
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().deleteTable().run()}
              className="h-8 w-8 p-0 text-red-500"
              title="Eliminar tabla"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* Imagen */}
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={addImage}
          className="h-8 w-8 p-0"
          title="Insertar imagen"
        >
          <ImageIcon className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// Componente principal del editor
const EditorWordResolucion = ({ contenido, onChange, placeholder = "Escribe el contenido de la resolución aquí..." }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: contenido || '',
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
    },
  });

  return (
    <div className="editor-word-container">
      <style>{editorStyles}</style>
      <MenuBar editor={editor} />
      <EditorContent editor={editor} className="tiptap-editor" />
    </div>
  );
};

export default EditorWordResolucion;
