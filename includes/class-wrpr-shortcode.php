<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WRPR_Shortcode {

    /**
     * Bootstrap shortcode functionality.
     *
     * @return void
     */
    public static function init() {
        add_shortcode( 'wrpr_reader', array( __CLASS__, 'render_reader' ) );
    }

    public static function render_reader( $atts ) {
        $atts = shortcode_atts(
            array(
                'id' => '',
            ),
            $atts
        );

        $reader_id = sanitize_text_field( $atts['id'] );

        if ( empty( $reader_id ) ) {
            return '<p>Invalid reader ID.</p>';
        }

        $readers = get_option( 'wrpr_readers', array() );

        if ( ! isset( $readers[ $reader_id ] ) ) {
            return '<p>Reader not found.</p>';
        }

        $reader = $readers[ $reader_id ];
        $books  = isset( $reader['books'] ) && is_array( $reader['books'] ) ? $reader['books'] : array();

        wp_enqueue_script( 'wrpr-renderer' );
        wp_enqueue_style( 'wrpr-style' );

        $langs = array();
        foreach ( $books as $book ) {
            $language = isset( $book['language'] ) ? $book['language'] : '';

            if ( '' === $language ) {
                continue;
            }

            if ( ! in_array( $language, $langs, true ) ) {
                $langs[] = $language;
            }
        }

        ob_start();
        ?>
        <div class="wrpr-reader-wrapper" data-reader-id="<?php echo esc_attr( $reader_id ); ?>">
            <div class="wrpr-header">
                <h2><?php echo esc_html( $reader['name'] ); ?></h2>
                <div class="wrpr-header-controls">
                    <select class="wrpr-language-filter">
                        <option value="all">All Languages</option>
                        <?php foreach ( $langs as $lang ) : ?>
                            <option value="<?php echo esc_attr( $lang ); ?>"><?php echo esc_html( $lang ); ?></option>
                        <?php endforeach; ?>
                    </select>
                    <a href="#" class="wrpr-header-buy">🛒 Buy Now</a>
                </div>
            </div>

            <div class="wrpr-book-grid">
                <?php foreach ( $books as $book ) :
                    $language = isset( $book['language'] ) ? $book['language'] : '';
                    $image    = isset( $book['image_url'] ) ? $book['image_url'] : '';
                    $title    = isset( $book['title'] ) ? $book['title'] : '';
                    $author   = isset( $book['author'] ) ? $book['author'] : '';
                    $pdf_url  = isset( $book['pdf_url'] ) ? $book['pdf_url'] : '';
                    $buy_link = isset( $book['buy_link'] ) ? $book['buy_link'] : '';
                    ?>
                    <div class="wrpr-book-card" data-language="<?php echo esc_attr( $language ); ?>">
                        <div class="wrpr-cover">
                            <img src="<?php echo esc_url( $image ); ?>" alt="<?php echo esc_attr( $title ); ?>">
                        </div>
                        <div class="wrpr-info">
                            <h4><?php echo esc_html( $title ); ?></h4>
                            <p><?php echo esc_html( $author ); ?></p>
                        </div>
                        <div class="wrpr-actions">
                            <button class="wrpr-open-btn" data-pdf="<?php echo esc_url( $pdf_url ); ?>">Read PDF</button>
                            <?php if ( ! empty( $buy_link ) ) : ?>
                                <a href="<?php echo esc_url( $buy_link ); ?>" target="_blank" class="wrpr-buy-link">Buy Now</a>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>

            <!-- PDF Modal -->
            <div id="wrpr-modal" style="display:none;">
                <div id="wrpr-pdf-viewer">
                    <div id="wrpr-pdf-container"></div>
                </div>
                <button id="wrpr-close">× Close</button>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }
}
