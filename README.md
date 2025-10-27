# Wisdom Rain PDF Reader

A WordPress plugin that provides a PDF reader interface and management tools within the WordPress admin dashboard.

The base bootstrap loads an admin module that registers the **WRPR PDF Engine** menu and related management subpages inside the WordPress dashboard.
Strings use the `wrpr` text domain so translation files can live in the `/languages` directory.

## Structure

```
wisdom-rain-pdf-reader/
├── assets/
│   ├── css/
│   └── js/
├── includes/
│   └── wrpr-admin.php
├── templates/
│   └── frontend-reader.php
├── languages/
│   └── .gitkeep
├── README.md
└── wisdom-rain-pdf-reader.php
```
