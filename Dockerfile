FROM php:8.2-apache

# 安装 mysqli 扩展
RUN docker-php-ext-install mysqli \
    && docker-php-ext-enable mysqli

# 设置 Apache DocumentRoot 指向 public 目录
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
        /etc/apache2/sites-available/000-default.conf \
        /etc/apache2/sites-available/default-ssl.conf

# 复制代码并调整权限
COPY . /var/www/html
RUN chown -R www-data:www-data /var/www/html/storage

# 启用必要模块
RUN a2enmod rewrite

WORKDIR /var/www/html/public
