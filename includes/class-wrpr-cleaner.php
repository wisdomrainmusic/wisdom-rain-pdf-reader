<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WRPR_Cleaner {

    /**
     * Clean Mammoth-generated HTML for A6 reader layout.
     *
     * @param string $html Raw HTML string.
     *
     * @return string Sanitized HTML ready for pagination.
     */
    public static function clean_html( $html ) {
        if ( ! is_string( $html ) || '' === trim( $html ) ) {
            return '';
        }

        $html = str_replace( ['<b', '</b>'], ['<strong', '</strong>'], $html );

        $flags = LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD;
        $dom   = new DOMDocument();
        libxml_use_internal_errors( true );
        $dom->loadHTML( '<?xml encoding="utf-8" ?>' . $html, $flags );
        libxml_clear_errors();

        $xpath = new DOMXPath( $dom );

        // Remove comments and scripts/styles.
        foreach ( iterator_to_array( $xpath->query( '//comment() | //script | //style' ) ) as $node ) {
            $node->parentNode->removeChild( $node );
        }

        self::unwrap_spans( $xpath );
        self::strip_attributes( $xpath );
        self::normalize_headings( $dom, $xpath );
        self::flatten_disallowed_tags( $xpath );
        self::clean_lists_and_strong( $xpath );
        self::remove_empty_blocks( $xpath );

        $body = $dom->getElementsByTagName( 'body' )->item( 0 );
        if ( ! $body ) {
            return '';
        }

        $clean = '';
        foreach ( iterator_to_array( $body->childNodes ) as $child ) {
            $clean .= $dom->saveHTML( $child );
        }

        return trim( $clean );
    }

    private static function unwrap_spans( DOMXPath $xpath ) {
        $spans = iterator_to_array( $xpath->query( '//span' ) );
        foreach ( $spans as $span ) {
            while ( $span->firstChild ) {
                $span->parentNode->insertBefore( $span->firstChild, $span );
            }
            $span->parentNode->removeChild( $span );
        }
    }

    private static function strip_attributes( DOMXPath $xpath ) {
        $nodes = iterator_to_array( $xpath->query( '//*' ) );
        foreach ( $nodes as $node ) {
            if ( ! $node->hasAttributes() ) {
                continue;
            }

            $allowed_attributes = array();
            if ( 'a' === strtolower( $node->nodeName ) ) {
                $allowed_attributes = array( 'href', 'target', 'rel' );
            }

            $remove = array();
            foreach ( iterator_to_array( $node->attributes ) as $attr ) {
                if ( ! in_array( strtolower( $attr->nodeName ), $allowed_attributes, true ) ) {
                    $remove[] = $attr->nodeName;
                }
            }

            foreach ( $remove as $name ) {
                $node->removeAttribute( $name );
            }
        }
    }

    private static function normalize_headings( DOMDocument $dom, DOMXPath $xpath ) {
        $h2_nodes = iterator_to_array( $xpath->query( '//h2' ) );
        foreach ( $h2_nodes as $h2 ) {
            $h3 = $dom->createElement( 'h3' );
            while ( $h2->firstChild ) {
                $h3->appendChild( $h2->firstChild );
            }
            $h2->parentNode->replaceChild( $h3, $h2 );
        }
    }

    private static function flatten_disallowed_tags( DOMXPath $xpath ) {
        $allowed = array( 'body', 'h1', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'a' );
        $nodes   = iterator_to_array( $xpath->query( '//*' ) );

        foreach ( $nodes as $node ) {
            $name = strtolower( $node->nodeName );
            if ( in_array( $name, $allowed, true ) ) {
                continue;
            }

            while ( $node->firstChild ) {
                $node->parentNode->insertBefore( $node->firstChild, $node );
            }
            $node->parentNode->removeChild( $node );
        }
    }

    private static function clean_lists_and_strong( DOMXPath $xpath ) {
        $list_strong = iterator_to_array( $xpath->query( '//li/strong | //li/b' ) );
        foreach ( $list_strong as $strong ) {
            $parent = $strong->parentNode;
            if ( $parent && $parent->childNodes->length === 1 ) {
                while ( $strong->firstChild ) {
                    $parent->insertBefore( $strong->firstChild, $strong );
                }
                $parent->removeChild( $strong );
            }
        }

        $paragraph_strong = iterator_to_array( $xpath->query( '//p/strong | //p/b' ) );
        foreach ( $paragraph_strong as $strong ) {
            $parent = $strong->parentNode;
            if ( ! $parent ) {
                continue;
            }

            $parent_name = strtolower( $parent->nodeName );
            $only_child  = 1 === $parent->childNodes->length;
            $is_heading  = in_array( $parent_name, array( 'h1', 'h3', 'h4' ), true );

            if ( $only_child && ! $is_heading ) {
                while ( $strong->firstChild ) {
                    $parent->insertBefore( $strong->firstChild, $strong );
                }
                $parent->removeChild( $strong );
            }
        }
    }

    private static function remove_empty_blocks( DOMXPath $xpath ) {
        foreach ( iterator_to_array( $xpath->query( '//br' ) ) as $br ) {
            $br->parentNode->removeChild( $br );
        }

        $blocks = iterator_to_array( $xpath->query( '//p|//li|//h1|//h3|//h4' ) );
        foreach ( $blocks as $node ) {
            $text        = trim( $node->textContent ?? '' );
            $has_element = false;

            foreach ( iterator_to_array( $node->childNodes ) as $child ) {
                if ( XML_ELEMENT_NODE === $child->nodeType ) {
                    $has_element = true;
                    break;
                }
            }

            if ( '' === $text && false === $has_element ) {
                $node->parentNode->removeChild( $node );
            }
        }
    }
}
