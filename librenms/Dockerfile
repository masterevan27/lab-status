FROM librenms/librenms:26.10.2

# 26.10.2's dependency validator still imports pkg_resources. Keep its last
# compatible setuptools API until upstream switches to importlib.metadata.
RUN pip3 install --no-cache-dir --break-system-packages setuptools==80.9.0
